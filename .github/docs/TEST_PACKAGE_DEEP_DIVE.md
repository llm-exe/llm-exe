# test-package: Visual Deep Dive

Concentrated diagrams for [.github/workflows/test-package.yml](../workflows/test-package.yml). This is the only workflow that exercises a packed `.tgz` against real provider APIs. Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers and the actor allowlist](#2-triggers-and-the-actor-allowlist)
- [3. The one-job DAG](#3-the-one-job-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. The build, pack, extract, replace, test pipeline](#5-the-build-pack-extract-replace-test-pipeline)
- [6. The provider key matrix](#6-the-provider-key-matrix)
- [7. External calls](#7-external-calls)
- [8. Why this workflow exists](#8-why-this-workflow-exists)
- [9. Output cascade](#9-output-cascade)
- [10. Failure modes](#10-failure-modes)
- [11. Quick reference card](#11-quick-reference-card)

---

## 1. The whole picture

How [test-package.yml](../workflows/test-package.yml) sits in the release path.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        d1["workflow_dispatch\n(manual only)"]:::trig
        pr1["pull_request\n(commented out)"]:::trig
    end

    subgraph G["Gate"]
        a1["if: sender.login == 'gregreindel'\n(actor allowlist)"]:::gate
        e1["environment: Examples Test\n(provider secrets scoped here)"]:::gate
    end

    subgraph A["test-package.yml"]
        J["test-package job\nubuntu-latest"]:::job
    end

    subgraph F["Files"]
        f1["package.json + lock"]:::file
        f2["src/ (built to dist/)"]:::file
        f3["llm-exe-&lt;version&gt;.tgz\n(npm pack output)"]:::file
        f4["temp_extract/package/dist/"]:::file
        f5["examples/*.test.ts"]:::file
        f6["examples/package.json\n(depends on '..')"]:::file
    end

    subgraph X["External providers"]
        x1["api.openai.com"]:::ext
        x2["api.anthropic.com"]:::ext
        x3["generativelanguage.googleapis.com"]:::ext
        x4["api.x.ai"]:::ext
        x5["api.deepseek.com"]:::ext
    end

    subgraph O["Outputs"]
        o1["green run\n(confidence the packed tarball works)"]:::out
        o2["red run\n(block release manually)"]:::out
    end

    subgraph D["Downstream (manual)"]
        rel["publish-release.yml\n(npm publish on release event)"]:::job
    end

    d1 --> a1
    pr1 -.disabled.-> a1
    a1 --> e1
    e1 --> J
    J --> f1
    f1 --> f2
    f2 --> f3
    f3 --> f4
    f4 --> f5
    f6 --> f5
    f5 --> x1
    f5 --> x2
    f5 --> x3
    f5 --> x4
    f5 --> x5
    J --> o1
    J --> o2
    o1 -.human signal.-> rel
```

[Back to top](#navigate)

---

## 2. Triggers and the actor allowlist

One trigger, two gates. The PR trigger is commented out on purpose.

```mermaid
flowchart TB
    classDef trig fill:#0e7490,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef env fill:#581c87,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|workflow_dispatch| g1{sender.login == 'gregreindel'?}:::gate
    ev -->|pull_request| dis[trigger is commented out\nignored at parse time]:::trig
    ev -->|anything else| stop1([no match, no run])

    g1 -->|no| stop2([job condition false, skipped])
    g1 -->|yes| g2["environment: Examples Test\n(GitHub gates secrets here)"]:::env
    g2 --> proc[(test-package job runs)]:::out

    dis -.-> stop3([never reaches here])
```

The job-level `if` expression is a defense-in-depth allowlist:

```
if: ${{ !(github.event.pull_request.base.ref == 'development' && github.event.pull_request.head.ref == 'bump-version-branch')
        || (github.event_name == 'workflow_dispatch' && github.event.sender.login == 'gregreindel') }}
```

In practice, since only `workflow_dispatch` is active, the condition that matters is the right-hand clause: actor must be `gregreindel`. The left-hand clause is a leftover for the disabled PR path.

The `environment: Examples Test` declaration is the real lock. Provider secrets only exist inside that environment. A fork PR or a different actor cannot read them even if the trigger fired.

Source: [.github/workflows/test-package.yml](../workflows/test-package.yml) lines 3-7 (triggers), 19-20 (environment + actor gate).

[Back to top](#navigate)

---

## 3. The one-job DAG

One job, eight steps, linear.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef env fill:#581c87,color:#fff,stroke:#000

    start([workflow_dispatch fires])
    start --> envBlock

    envBlock["env block injects\n5 provider API keys"]:::env

    subgraph J["Job: test-package (ubuntu-latest, env: Examples Test)"]
        direction TB
        s1["Checkout repository\nactions/checkout@v6"]:::step
        s2["Use Latest Node.js 22.x\nactions/setup-node@v6 (cache: npm)"]:::step
        s3["Cache npm dependencies\n./.github/actions/cache"]:::step
        s4["Install dependencies\nnpm install"]:::step
        s5["Build package and pack package\nnpm run build:package &amp;&amp; npm pack"]:::step
        s6["Copy path of packed package\nfind llm-exe-*.tgz, export PACKED_PACKAGE_PATH"]:::step
        s7["Extract tarball and replace dist folder\ntar -xzf, rm -rf dist, cp -r temp_extract/package/dist ."]:::step
        s8["Install dependencies in examples directory\ncd examples &amp;&amp; npm install"]:::step
        s9["List files\nls -la (debug)"]:::step
        s10["Run tests\nNODE_OPTIONS=... npm run test-examples"]:::step
        s1 --> s2 --> s3 --> s4 --> s5 --> s6 --> s7 --> s8 --> s9 --> s10
    end

    envBlock --> s1
```

Concurrency group is `${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`. A second dispatch on the same ref cancels the first.

Permissions: `id-token: write`, `contents: write`. The `id-token` is for OIDC if needed by future steps; nothing in the current workflow consumes it.

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

One run from dispatch to test results, with every file movement.

```mermaid
sequenceDiagram
    autonumber
    participant U as Maintainer
    participant E as Event
    participant J as test-package job
    participant N as Node 22 + npm
    participant B as tsup build
    participant P as npm pack
    participant FS as Filesystem
    participant EX as examples/ workspace
    participant LLM as 5 provider APIs

    U->>E: workflow_dispatch (actor=gregreindel)
    E->>J: gate check (actor + environment)
    J->>FS: checkout repo at ref
    J->>N: setup-node@v6 (22.x, cache: npm)
    J->>N: ./.github/actions/cache (warm node_modules)
    J->>N: npm install (dev deps for build)
    J->>B: npm run build:package (tsup, external deps)
    B-->>FS: dist/index.js, dist/index.mjs, dist/index.d.ts
    J->>P: npm pack
    P-->>FS: llm-exe-2.3.6.tgz at repo root
    J->>FS: find . -maxdepth 1 -name 'llm-exe-*.tgz'
    FS-->>J: PACKED_PACKAGE_PATH env var
    J->>FS: mkdir temp_extract; tar -xzf into it
    J->>FS: rm -rf dist
    J->>FS: cp -r temp_extract/package/dist .
    J->>FS: rm -rf temp_extract
    Note over FS: dist/ now mirrors what npm would install
    J->>EX: cd examples; npm install
    EX-->>FS: examples/node_modules/llm-exe -> .. (file: link)
    J->>FS: ls -la (debug snapshot)
    J->>N: export NODE_OPTIONS, npm run test-examples
    N->>EX: jest with examples roots
    EX->>LLM: 5 providers via env-keyed clients
    LLM-->>EX: real model responses
    EX-->>J: pass / fail
    J-->>U: workflow run status
```

Source: [.github/workflows/test-package.yml](../workflows/test-package.yml) lines 27-71.

[Back to top](#navigate)

---

## 5. The build, pack, extract, replace, test pipeline

The non-obvious dance is steps 5 through 7. It exists to make the test consume the *packed* artifact, not the *source* tree.

```mermaid
flowchart TB
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef pack fill:#7c2d12,color:#fff,stroke:#000
    classDef extract fill:#581c87,color:#fff,stroke:#000
    classDef test fill:#064e3b,color:#fff,stroke:#000

    A["src/index.ts\n+ dependencies"]:::src
    A --> B["npm run build:package\ntsup, externalizes large deps"]:::src
    B --> C["dist/ (CJS + ESM + .d.ts)\nthe in-tree build"]:::src

    C --> D["npm pack\nrespects 'files: [dist]' in package.json"]:::pack
    D --> E["llm-exe-2.3.6.tgz at repo root\ncontents: package/dist/, package/package.json, ..."]:::pack

    E --> F["find . -maxdepth 1 -name 'llm-exe-*.tgz'\nexport PACKED_PACKAGE_PATH"]:::extract
    F --> G["mkdir temp_extract\ntar -xzf $PACKED_PACKAGE_PATH -C temp_extract"]:::extract
    G --> H["rm -rf dist\nthrow away the in-tree build"]:::extract
    H --> I["cp -r temp_extract/package/dist .\nreplace with the packed dist"]:::extract
    I --> J["rm -rf temp_extract\ncleanup"]:::extract

    J --> K["examples/package.json\ndeclares 'llm-exe': '..'"]:::test
    K --> L["cd examples; npm install\nresolves llm-exe to parent via file: link"]:::test
    L --> M["jest reads parent dist/\nwhich is now the packed dist"]:::test
    M --> N["7 example .test.ts files\ncall real provider APIs"]:::test
```

Why the swap matters: `examples/` consumes `llm-exe` via a file dependency (`"llm-exe": ".."`). Without the swap, jest would import from the in-tree `dist/` which could contain anything the build emitted, including files that npm's `files: [dist]` filter would exclude. After the swap, the imported `dist/` is byte-identical to what an end user gets via `npm install llm-exe`.

The packed contents differ from the source tree because:

- `files: ["dist"]` in [package.json](../../package.json) line 31-33 restricts publish to `dist/`
- `build:package` externalizes `jsonschema`, `json-schema-to-ts`, `exponential-backoff`, and the AWS/Smithy modules (see line 46) so they resolve from a consumer's `node_modules`, not bundled in

[Back to top](#navigate)

---

## 6. The provider key matrix

Five secrets, five providers, one job. All injected at the job level via `env:`.

```mermaid
flowchart LR
    classDef sec fill:#7c2d12,color:#fff,stroke:#000
    classDef env fill:#581c87,color:#fff,stroke:#000
    classDef prov fill:#064e3b,color:#fff,stroke:#000
    classDef test fill:#1e3a8a,color:#fff,stroke:#000

    subgraph S["GitHub environment: Examples Test"]
        s1["OPENAI_API_KEY"]:::sec
        s2["ANTHROPIC_API_KEY"]:::sec
        s3["GEMINI_API_KEY"]:::sec
        s4["XAI_API_KEY"]:::sec
        s5["DEEPSEEK_API_KEY"]:::sec
    end

    subgraph E["Job env (lines 22-26)"]
        e1["OPENAI_API_KEY"]:::env
        e2["ANTHROPIC_API_KEY"]:::env
        e3["GEMINI_API_KEY"]:::env
        e4["XAI_API_KEY"]:::env
        e5["DEEPSEEK_API_KEY"]:::env
    end

    subgraph P["Provider clients in src/llm/"]
        p1["openai.gpt-4o-mini"]:::prov
        p2["anthropic.claude-sonnet-4"]:::prov
        p3["google.gemini-2.5-flash"]:::prov
        p4["xai.grok-3"]:::prov
        p5["deepseek.chat"]:::prov
    end

    subgraph T["examples/helloWorld.test.ts (itWithUseLlmMocked)"]
        t1["loops over 5 provider keys\ncalls each with same prompt\nasserts response contains expected substring"]:::test
    end

    s1 --> e1 --> p1 --> t1
    s2 --> e2 --> p2 --> t1
    s3 --> e3 --> p3 --> t1
    s4 --> e4 --> p4 --> t1
    s5 --> e5 --> p5 --> t1
```

The shape of the test loop in [examples/helloWorld.test.ts](../../examples/helloWorld.test.ts):

```
itWithUseLlmMocked(
  "handle this simple instruction",
  [
    "anthropic.claude-sonnet-4",
    "openai.gpt-4o-mini",
    "google.gemini-2.5-flash",
    "xai.grok-3",
    "deepseek.chat",
  ],
  async (config) => { ... }
);
```

Each provider gets its own jest test case. If a key is missing or revoked, only that one provider's case fails.

[Back to top](#navigate)

---

## 7. External calls

Five real LLM providers, one identity per provider, one shared workflow run.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef llm fill:#581c87,color:#fff,stroke:#000
    classDef reg fill:#1f2937,color:#fff,stroke:#000

    subgraph Pre["Before tests"]
        c1["actions/checkout@v6\nauth: GITHUB_TOKEN\nwhy: get source"]:::pre
        c2["actions/setup-node@v6\nauth: none\nwhy: Node 22.x install"]:::pre
        c3["registry.npmjs.org\nauth: none\nwhy: npm install (dev deps + examples deps)"]:::reg
    end

    subgraph During["During tests (real provider calls)"]
        d1["api.openai.com/v1/chat/completions\nauth: OPENAI_API_KEY\nmodel: gpt-4o-mini"]:::llm
        d2["api.anthropic.com/v1/messages\nauth: ANTHROPIC_API_KEY\nmodel: claude-sonnet-4"]:::llm
        d3["generativelanguage.googleapis.com\nauth: GEMINI_API_KEY\nmodel: gemini-2.5-flash"]:::llm
        d4["api.x.ai/v1/chat/completions\nauth: XAI_API_KEY\nmodel: grok-3"]:::llm
        d5["api.deepseek.com/chat/completions\nauth: DEEPSEEK_API_KEY\nmodel: deepseek-chat"]:::llm
    end

    c1 --> c2 --> c3
    c3 --> d1
    c3 --> d2
    c3 --> d3
    c3 --> d4
    c3 --> d5
```

This is the only workflow in the repo that contacts real provider APIs. Every other workflow either:

- uses the `openai.chat-mock.v1` mock LLM (tests.yml), or
- talks to Anthropic via Claude Code OAuth, not the llm-exe provider clients (agent-run.yml)

[Back to top](#navigate)

---

## 8. Why this workflow exists

The integration gap that this workflow closes.

```mermaid
flowchart TB
    classDef gap fill:#7c2d12,color:#fff,stroke:#000
    classDef cov fill:#0e7490,color:#fff,stroke:#000
    classDef done fill:#064e3b,color:#fff,stroke:#000

    subgraph Q["What other CI does NOT prove"]
        q1["tests.yml runs jest with mock LLM\nproves: code logic, no provider regressions in mock\ndoes NOT prove: real APIs still accept our payload"]:::gap
        q2["typecheck proves types compile\ndoes NOT prove: runtime shape matches provider response"]:::gap
        q3["pack-package.yml uploads .tgz artifact\ndoes NOT prove: tarball is importable end-to-end"]:::gap
    end

    subgraph C["What test-package.yml proves"]
        c1["The packed tarball matches what npm would publish\n(files filter + externals correctly applied)"]:::cov
        c2["A consumer can install it via 'llm-exe': '..' and import it"]:::cov
        c3["Each provider's request/response shape still parses\ncorrectly under real API behavior"]:::cov
        c4["Examples in the repo still execute against current APIs\n(catches provider-side breaking changes)"]:::cov
    end

    Q --> C --> R[("manual sign-off signal\nfor the next release")]:::done
```

The cost meter is real money: every dispatch consumes paid tokens across all five providers. That is why it is gated to `workflow_dispatch` plus actor allowlist, not automated.

[Back to top](#navigate)

---

## 9. Output cascade

What this workflow produces and what consumes the signal.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    TP["test-package.yml\nrun completes"]:::src

    TP --> O1["green check on Actions UI\n(no artifacts, no commits)"]:::out
    TP --> O2["red X on Actions UI\n(blocks confidence)"]:::out
    TP --> O3["test logs in workflow output\n(provider responses visible)"]:::out

    O1 --> H1["maintainer reads result\nas pre-release smoke signal"]:::human
    O2 --> H1
    O3 --> H1

    H1 --> M{publish decision}:::human
    M -->|green| PR["publish-release.yml\ntriggered by release: published\nrequires actor=gregreindel + branch=main"]:::cons
    M -->|red| FX["investigate failing provider\nor revert offending change"]:::human

    PR --> NPM["npm publish to registry.npmjs.org"]:::cons
```

There is no automated wire from `test-package.yml` to `publish-release.yml`. The cascade is human-mediated: a maintainer dispatches this workflow, reads the result, and decides whether to cut a release. The shared actor allowlist (`gregreindel`) on both workflows means only one person can do either side.

[Back to top](#navigate)

---

## 10. Failure modes

Where things break, what happens, what to do.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["Non-allowlisted actor dispatches"]:::fail
    F1 --> F1E["job-level if evaluates false\njob shows as skipped"]:::effect
    F1E --> F1X["expected, no action\nadd login to allowlist if needed"]:::fix

    F2["Environment secret missing\n(e.g. XAI_API_KEY rotated and not re-added)"]:::fail
    F2 --> F2E["env var empty at runtime\nthat provider's test case fails\n(other 4 still run)"]:::effect
    F2X["re-add secret in Examples Test environment"]:::fix
    F2E --> F2X

    F3["npm install fails\n(registry hiccup or lock drift)"]:::fail
    F3 --> F3E["job halts before pack\nno tarball produced"]:::effect
    F3X["retry, or fix package-lock"]:::fix
    F3E --> F3X

    F4["build:package emits broken dist"]:::fail
    F4 --> F4E["npm pack succeeds but tarball imports fail\nexamples error at require time"]:::effect
    F4X["fix tsup config, externals, or src/"]:::fix
    F4E --> F4X

    F5["Provider API breaking change\n(response shape, error code, model deprecated)"]:::fail
    F5 --> F5E["that provider's example test fails\ncatches real-world regression"]:::effect
    F5X["update src/llm/&lt;provider&gt;/ client\nor the example test"]:::fix
    F5E --> F5X

    F6["Provider outage / 5xx"]:::fail
    F6 --> F6E["test fails with network error\nnot a code bug"]:::effect
    F6X["wait, re-dispatch later"]:::fix
    F6E --> F6X

    F7["Rate limit hit during run"]:::fail
    F7 --> F7E["429 from provider\ntest fails for that one case"]:::effect
    F7X["jest.config.examples.ts has maxWorkers: 2\nand bail: 1 to limit blast radius\nre-dispatch after cooldown"]:::fix
    F7E --> F7X

    F8["Second dispatch fired on same ref"]:::fail
    F8 --> F8E["concurrency group cancels first run\n(cancel-in-progress: true)"]:::effect
    F8X["intentional, prevents cost double-up"]:::fix
    F8E --> F8X

    F9["Token budget concern\n(every run costs real money on 5 providers)"]:::fail
    F9 --> F9E["each dispatch burns paid credits"]:::effect
    F9X["actor allowlist + manual trigger\nare the rate limiter"]:::fix
    F9E --> F9X
```

Note that `bail: 1` in [jest.config.examples.ts](../../jest.config.examples.ts) means the suite stops at the first failure. Combined with `maxWorkers: 2`, this caps the worst case at a few extra provider calls before the run aborts.

[Back to top](#navigate)

---

## 11. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/test-package.yml"]:::v
    K2["Triggers"]:::k --- V2["workflow_dispatch only (PR disabled)"]:::v
    K3["Actor gate"]:::k --- V3["sender.login == 'gregreindel'"]:::v
    K4["Environment"]:::k --- V4["Examples Test (scopes provider secrets)"]:::v
    K5["Permissions"]:::k --- V5["id-token: write, contents: write"]:::v
    K6["Concurrency"]:::k --- V6["workflow + ref, cancel-in-progress: true"]:::v
    K7["Runner"]:::k --- V7["ubuntu-latest"]:::v
    K8["Node version"]:::k --- V8["22.x (not the shared setup-node action)"]:::v
    K9["Cache action"]:::k --- V9["./.github/actions/cache"]:::v
    K10["Build command"]:::k --- V10["npm run build:package (tsup, externals)"]:::v
    K11["Pack command"]:::k --- V11["npm pack (respects files: [dist])"]:::v
    K12["Tarball path"]:::k --- V12["llm-exe-&lt;version&gt;.tgz at repo root"]:::v
    K13["Dist swap"]:::k --- V13["dist/ replaced with temp_extract/package/dist"]:::v
    K14["Examples link"]:::k --- V14["examples/package.json: 'llm-exe': '..'"]:::v
    K15["Test command"]:::k --- V15["npm run test-examples"]:::v
    K16["Test config"]:::k --- V16["jest.config.examples.ts (bail: 1, maxWorkers: 2)"]:::v
    K17["NODE_OPTIONS"]:::k --- V17["--max-old-space-size=4096 --experimental-vm-modules"]:::v
    K18["Providers tested"]:::k --- V18["openai, anthropic, google, xai, deepseek"]:::v
    K19["Provider secrets"]:::k --- V19["5 *_API_KEY values in Examples Test env"]:::v
    K20["Downstream"]:::k --- V20["publish-release.yml (human-mediated)"]:::v
```

Direct links:

- Workflow file: [.github/workflows/test-package.yml](../workflows/test-package.yml)
- Cache action: [.github/actions/cache/action.yml](../actions/cache/action.yml)
- Setup-node action: [.github/actions/setup-node/action.yml](../actions/setup-node/action.yml) (note: this workflow does NOT use the shared action, it pins 22.x directly)
- Release workflow: [.github/workflows/publish-release.yml](../workflows/publish-release.yml)
- Examples package: [examples/package.json](../../examples/package.json)
- Jest examples config: [jest.config.examples.ts](../../jest.config.examples.ts)
- Build script: see `build:package` in [package.json](../../package.json) line 46
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)

[Back to top](#navigate)
