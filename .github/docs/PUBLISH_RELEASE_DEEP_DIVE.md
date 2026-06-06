# publish-release: Visual Deep Dive

Concentrated diagrams for [.github/workflows/publish-release.yml](../workflows/publish-release.yml) and the composite actions it leans on. Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers](#2-triggers)
- [3. The four-job DAG](#3-the-four-job-dag)
- [4. The two-layer guard](#4-the-two-layer-guard)
- [5. Step-by-step lifecycle](#5-step-by-step-lifecycle)
- [6. Version routing](#6-version-routing)
- [7. External calls](#7-external-calls)
- [8. The rollback path](#8-the-rollback-path)
- [9. Output cascade](#9-output-cascade)
- [10. State machine](#10-state-machine)
- [11. Failure modes](#11-failure-modes)
- [12. Quick reference card](#12-quick-reference-card)

---

## 1. The whole picture

How [publish-release.yml](../workflows/publish-release.yml) plugs into npm, GitHub Releases, and OIDC provenance, including the rollback edge.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef bad fill:#991b1b,color:#fff,stroke:#000

    subgraph T["Triggers"]
        t1["release.published\n(typical path)"]:::trig
        t2["workflow_dispatch\n(manual republish)"]:::trig
    end

    subgraph W["publish-release.yml"]
        J1["check-release-branch\ntarget_commitish == 'main'?"]:::gate
        J2["run-examples-tests\nExamples Test environment\nreal provider keys"]:::job
        J3["publish-npm-package\nactor in ALLOWED_PUBLISHERS?"]:::job
        J4["revert-to-draft\n(on failure of J2 or J3)"]:::bad
    end

    subgraph S["Secrets and Identity"]
        s1["APP_ID + APP_PRIVATE_KEY\n(used only by revert job)"]:::file
        s2["NODE_AUTH_TOKEN\n(npm auth via registry-url)"]:::file
        s3["OIDC token\nid-token: write"]:::file
        s4["Provider API keys\n(OpenAI, Anthropic, Gemini,\nxAI, DeepSeek, AWS)"]:::file
    end

    subgraph F["Local artifacts"]
        pkg["package.json\nversion string"]:::file
        dist["dist/ tarball\nbuilt by tsup"]:::file
    end

    subgraph X["External"]
        npm["registry.npmjs.org\n(npm publish)"]:::ext
        gh["api.github.com\n(PATCH releases on failure)"]:::ext
        prov["Provider APIs\n(examples tests)"]:::ext
    end

    subgraph O["Outputs"]
        ok["npm tarball\n(latest or beta tag)"]:::out
        provA["sigstore provenance\n(OIDC attestation)"]:::out
        rel["GitHub Release\nremains published"]:::out
        bad1["GitHub Release\nreverted to draft + warning"]:::bad
    end

    t1 --> J1
    t2 --> J2
    J1 -->|main| J2
    J1 -->|not main| stop1([fail])
    s4 --> J2
    J2 --> J3
    s2 --> J3
    s3 --> J3
    J3 --> pkg
    J3 --> dist
    dist --> npm
    npm --> ok
    s3 --> provA
    npm --> provA
    J3 --> rel
    J2 -.failure.-> J4
    J3 -.failure.-> J4
    s1 --> J4
    J4 -.release event.-> gh
    gh --> bad1
    J2 --> prov
```

[Back to top](#navigate)

---

## 2. Triggers

Two entry points. One is the normal automated path, the other is the manual escape hatch.

```mermaid
flowchart TB
    classDef rel fill:#0e7490,color:#fff,stroke:#000
    classDef manual fill:#9333ea,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000
    classDef stop fill:#7c2d12,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|release| relA{action?}
    ev -->|workflow_dispatch| disp["manual run\n(no payload validation)"]:::manual

    relA -->|published| relB["release payload available\n(release.target_commitish, release.id, release.body)"]:::rel
    relA -->|any other| skip([ignored])

    relB --> J1{target_commitish\n== 'main'?}
    J1 -->|yes| ok1[/proceed to publish-npm-package/]:::out
    J1 -->|no| fail1([exit 1, fail check-release-branch]):::stop

    disp --> J1bypass["check-release-branch step is skipped\n(its 'if' requires event_name == release)"]:::manual
    J1bypass --> ok1
```

Source: [.github/workflows/publish-release.yml](../workflows/publish-release.yml) lines 3-8 (triggers), 18-26 (branch check).

Note on the manual path: the branch check step's `if` clause requires `github.event_name == 'release'`, so a `workflow_dispatch` run hits an effectively empty `check-release-branch` job that always succeeds. The actor allowlist (Section 4) is what stops unauthorized manual republishes.

[Back to top](#navigate)

---

## 3. The four-job DAG

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef cleanup fill:#581c87,color:#fff,stroke:#000

    start([Workflow event])
    start --> J1

    subgraph J1["Job: check-release-branch (ubuntu-latest)"]
        direction TB
        c1["Check if release is from main branch\nif: event_name == release && action == published\nrun: jq target_commitish, fail if not main"]:::gate
    end

    J1 -->|needs| J2

    subgraph J2["Job: run-examples-tests (ubuntu-latest, Examples Test env)"]
        direction TB
        e1["actions/checkout@v4"]:::step
        e2["setup-node@v4 Node 22.x"]:::step
        e3["./.github/actions/cache"]:::step
        e4["npm install"]:::step
        e5["npm run build:package && npm pack"]:::step
        e6["Extract tarball, replace dist/"]:::step
        e7["cd examples && npm install"]:::step
        e8["npm run test-examples\n(real provider keys)"]:::step
        e1 --> e2 --> e3 --> e4 --> e5 --> e6 --> e7 --> e8
    end

    J2 -->|needs| J3
    J1 -->|needs| J3

    subgraph J3["Job: publish-npm-package (ubuntu-latest)"]
        direction TB
        s1["actions/checkout@v4"]:::step
        s2["Validate Publisher\n(actor allowlist)"]:::gate
        s3["./.github/actions/setup-node\n(Node 24.x + npm registry-url)"]:::step
        s4["./.github/actions/cache\n(~/.npm + node_modules)"]:::step
        s5["npm install"]:::step
        s6["npm run build:package\n(tsup CJS+ESM+DTS)"]:::step
        s7["Publish (route by version)"]:::step
        s1 --> s2 --> s3 --> s4 --> s5 --> s6 --> s7
    end

    J2 -.->|needs| J4
    J3 -.->|needs| J4

    subgraph J4["Job: revert-to-draft (ubuntu-latest)"]
        direction TB
        r1["if: always() && release event &&\n(examples failed || publish failed)"]:::gate
        r2["Generate bot token\n(create-github-app-token@v1)"]:::step
        r3["Revert release to draft\n(PATCH with warning banner)"]:::cleanup
        r1 --> r2 --> r3
    end
```

The DAG has four jobs: `check-release-branch` gates `run-examples-tests`, which gates `publish-npm-package`. The `revert-to-draft` job depends on both `run-examples-tests` and `publish-npm-package` and only fires when either fails during a release event. No concurrency group is declared, so two concurrent dispatch runs are theoretically possible but npm itself rejects duplicate versions.

[Back to top](#navigate)

---

## 4. The two-layer guard

Two independent gates. Both must pass.

```mermaid
flowchart TB
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef pass fill:#064e3b,color:#fff,stroke:#000
    classDef fail fill:#991b1b,color:#fff,stroke:#000
    classDef note fill:#374151,color:#fff,stroke:#000

    start([Event payload arrives])

    start --> L1{Layer 1: branch gate\nevent_name == release?}
    L1 -->|no, dispatch| L1skip["step skipped by 'if'\nlayer passes by default"]:::note
    L1 -->|yes| L1c{target_commitish == 'main'?}
    L1c -->|no| X1([exit 1\ncheck-release-branch fails\npublish-npm-package never runs]):::fail
    L1c -->|yes| L1pass[Layer 1 OK]:::pass
    L1skip --> L2
    L1pass --> L2

    L2{Layer 2: actor gate\ngithub.actor in 'gregreindel'?}
    L2 -->|no| X2([exit 1\nstep fails after checkout\nbefore install or build]):::fail
    L2 -->|yes| ok([proceed: install, build, publish]):::pass
```

Why two layers?

- Layer 1 stops accidental publishes from a feature branch tag. A release cut from `development` will fail before any code runs.
- Layer 2 stops the wrong human from triggering `workflow_dispatch` (which bypasses Layer 1).

Together they cover both the automated and manual entry points. Neither alone is sufficient.

Source: [publish-release.yml](../workflows/publish-release.yml) lines 18-26 (Layer 1), 88-95 (Layer 2).

[Back to top](#navigate)

---

## 5. Step-by-step lifecycle

One successful publish from event to npm registry, including the examples tests gate.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event
    participant C1 as check-release-branch
    participant EX as run-examples-tests
    participant P as Provider APIs
    participant J as publish-npm-package
    participant N as Node + npm
    participant B as tsup build
    participant R as registry.npmjs.org
    participant S as sigstore (OIDC)

    E->>C1: release.published (target_commitish=main)
    C1->>C1: jq target_commitish from GITHUB_EVENT_PATH
    C1-->>EX: needs satisfied
    EX->>EX: checkout, setup-node 22.x, cache, npm install
    EX->>EX: npm run build:package && npm pack
    EX->>EX: extract tarball, replace dist/
    EX->>EX: cd examples && npm install
    EX->>P: npm run test-examples (real provider keys)
    P-->>EX: examples pass
    EX-->>J: needs satisfied
    J->>J: actions/checkout@v4
    J->>J: Validate Publisher (actor in allowlist)
    J->>N: setup-node composite (Node 24.x, registry-url npmjs.org)
    Note over N: registry-url makes npm write an .npmrc with NODE_AUTH_TOKEN
    J->>N: cache restore (~/.npm + node_modules)
    J->>N: npm install
    J->>B: npm run build:package (tsup CJS + ESM + DTS, externals listed)
    B-->>J: dist/ ready
    J->>J: read package.json version
    alt version has -CHANNEL (e.g. -beta.0, -rc.1, -alpha.2)
        J->>R: npm publish --provenance --tag CHANNEL
    else version has "-" but no alphabetic channel
        J->>J: exit 1 (refuse to publish, would clobber 'latest')
    else stable version (no "-")
        J->>R: npm run publish-main (npm publish --provenance)
    end
    R->>S: request provenance attestation
    S-->>R: signed attestation (OIDC id-token)
    R-->>J: 200 OK, tarball live
```

Source: [publish-release.yml](../workflows/publish-release.yml) lines 27-121.

[Back to top](#navigate)

---

## 6. Version routing

The published package.json version string determines the npm dist-tag. Any semver pre-release suffix (anything after a `-`) routes to a named dist-tag derived from the first alphabetic chunk.

```mermaid
flowchart LR
    classDef read fill:#1e3a8a,color:#fff,stroke:#000
    classDef dec fill:#7c2d12,color:#fff,stroke:#000
    classDef main fill:#064e3b,color:#fff,stroke:#000
    classDef pre fill:#581c87,color:#fff,stroke:#000
    classDef refuse fill:#991b1b,color:#fff,stroke:#000

    A["node -p require('./package.json').version"]:::read
    A --> D{version contains '-'?}

    D -->|no\ne.g. 2.3.6| M1["echo Publishing main version"]:::main
    M1 --> M2["npm run publish-main\n= npm publish --provenance"]:::main
    M2 --> M3["dist-tag: latest\n(default)"]:::main

    D -->|yes| C{regex -([a-zA-Z]+)\nmatches alphabetic channel?}
    C -->|yes\ne.g. -beta.0, -rc.1, -alpha.2| B1["TAG = first alphabetic chunk\n(beta, rc, alpha, ...)"]:::pre
    B1 --> B2["npm publish --provenance --tag $TAG\n(no package.json script)"]:::pre
    B2 --> B3["dist-tag: $TAG\nlatest unchanged"]:::pre

    C -->|no\ne.g. 3.0.0-1234 with no letters| R1["exit 1\n'pre-release has no alphabetic channel'"]:::refuse
    R1 --> R2["refuse to publish\n(would silently clobber 'latest')"]:::refuse
```

Source: [publish-release.yml](../workflows/publish-release.yml) lines 110-131. Stable script in [package.json](../../package.json).

Why this matters: `npm publish --provenance` with no `--tag` flag overwrites the `latest` dist-tag. Any pre-release must use `--tag CHANNEL` so it does not become the default install for `npm i llm-exe`. The workflow infers the channel from the version: `3.0.0-beta.0` -> `beta`, `3.0.0-rc.1` -> `rc`, `3.0.0-alpha.2` -> `alpha`. A version with a `-` but no alphabetic channel (e.g. `3.0.0-1234`) is refused outright rather than risk publishing to `latest`. All publish paths pass `--provenance` to request OIDC-based supply-chain attestation (errors if the environment lacks `id-token: write`).

[Back to top](#navigate)

---

## 7. External calls

Who is contacted, with what credential, why.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef test fill:#1e3a8a,color:#fff,stroke:#000
    classDef pub fill:#064e3b,color:#fff,stroke:#000
    classDef rb fill:#7c2d12,color:#fff,stroke:#000

    subgraph ExTest["Examples tests job"]
        e1["actions/checkout@v4\nauth: GITHUB_TOKEN (default)\nwhy: source for build + pack"]:::test
        e2["actions/setup-node@v4\nauth: none\nwhy: Node 22.x"]:::test
        e3["Provider APIs (OpenAI, Anthropic,\nGemini, xAI, DeepSeek)\nauth: per-provider API keys\nwhy: real integration tests"]:::test
    end

    subgraph Pre["Publish job setup"]
        c1["actions/checkout@v4\nauth: GITHUB_TOKEN (default)\nwhy: source for build"]:::pre
        c2["actions/setup-node@v4 (composite)\nauth: none\nwhy: Node 24.x + npm registry-url"]:::pre
        c3["actions/cache@v4 (composite)\nauth: none\nwhy: speed up npm install"]:::pre
    end

    subgraph Pub["Publish"]
        d1["registry.npmjs.org\nauth: NODE_AUTH_TOKEN (from npm secret + registry-url)\nwhy: npm publish (main or beta tag)"]:::pub
        d2["sigstore via OIDC\nauth: GitHub-issued id-token\nwhy: npm provenance attestation"]:::pub
    end

    subgraph Rb["Failure rollback (separate job, release event only)"]
        d3["actions/create-github-app-token@v1\nauth: APP_ID + APP_PRIVATE_KEY\nwhy: mint bot token for PATCH"]:::rb
        d4["api.github.com PATCH /releases/:id\nauth: bot token from step 'bot-token'\nwhy: flip published release to draft and prepend warning"]:::rb
        d3 --> d4
    end

    e1 --> e2 --> e3
    e3 --> c1
    c1 --> c2 --> c3 --> d1
    d1 --> d2
    e3 -.failure.-> d3
    d1 -.failure.-> d3
```

The npm token (used by `npm publish`) is configured by the setup-node composite action consuming the `registry-url` and the `NODE_AUTH_TOKEN` env var. Provenance is explicitly requested via the `--provenance` flag in both publish scripts; this requires `id-token: write` (granted at the top of the file) and will fail if the OIDC token cannot be issued. The bot token from `create-github-app-token@v1` is minted only in the `revert-to-draft` job and only used by the rollback step.

[Back to top](#navigate)

---

## 8. The rollback path

The `revert-to-draft` job is a dedicated rollback job that runs after both `run-examples-tests` and `publish-npm-package` complete (in any state). Preserves the original release body.

```mermaid
flowchart TB
    classDef trig fill:#7c2d12,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000
    classDef fail fill:#991b1b,color:#fff,stroke:#000

    A["revert-to-draft job starts\nif: always() && release event &&\n(examples failed || publish failed)"]:::trig
    A --> B{condition met?}
    B -->|no: dispatch, or both passed| skip([job skipped]):::fail
    B -->|yes| T["Generate bot token\n(create-github-app-token@v1)"]:::step
    T --> C["read release.id and release.body\nfrom GITHUB_EVENT_PATH via jq"]:::step

    C --> D0{which job failed?}
    D0 -->|examples tests| D0a["FAILURE_REASON =\n'the examples tests failed before publishing'"]:::step
    D0 -->|publish| D0b["FAILURE_REASON =\n'the package failed to publish to npm'"]:::step
    D0a --> D
    D0b --> D

    D["heredoc release_body.txt\nwith WARNING banner referencing WORKFLOW_URL"]:::step
    D --> E["sed -i replace FAILURE_REASON and WORKFLOW_URL"]:::step
    E --> F["append ORIGINAL_BODY to banner\n(separator line, then full original notes)"]:::step
    F --> G["jq -Rs '.' to JSON-escape the file"]:::step
    G --> H["curl PATCH /repos/:repo/releases/:id\nbody: {draft:true, body: BODY_JSON}\nAuth: bot token from step output"]:::step
    H --> I{response has .id?}
    I -->|yes| OK["Release reverted to draft with original notes preserved"]:::out
    I -->|no| WARN["log warning, dump response\n(workflow still marked failed)"]:::fail
```

Source: [publish-release.yml](../workflows/publish-release.yml) lines 123-177.

Key invariants:

- Original release body is never lost. The banner is prepended; the original is appended verbatim from the event payload.
- The warning banner includes a specific failure reason: examples tests or npm publish, so the maintainer knows which step to investigate.
- The workflow URL is computed from `github.server_url`, `github.repository`, `github.run_id`. No magic strings.
- The PATCH uses the bot token (App identity) rather than `GITHUB_TOKEN`, which lets the change look like the bot acted rather than the GitHub Actions service account.
- The job uses `always()` combined with explicit `needs.*.result == 'failure'` checks to ensure it runs even when upstream jobs fail. A failure of `check-release-branch` short-circuits before examples or publish ever run, so the rollback never executes for a wrong-branch release. That is intentional: a wrong-branch release should not be auto-drafted by this workflow.

[Back to top](#navigate)

---

## 9. Output cascade

What this workflow produces and who consumes it.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef ok fill:#064e3b,color:#fff,stroke:#000
    classDef bad fill:#991b1b,color:#fff,stroke:#000
    classDef cons fill:#374151,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    W["publish-release.yml"]:::src

    W -->|success| O1["npm tarball at\nregistry.npmjs.org/llm-exe"]:::ok
    W -->|success| O2["sigstore provenance attestation\n(visible on npm package page)"]:::ok
    W -->|success| O3["GitHub Release remains in\npublished state"]:::ok
    W -.failure on release event.-> O4["GitHub Release flipped to draft\nwith warning banner"]:::bad
    W -.failure on dispatch.-> O5["workflow run marked failed\nno rollback"]:::bad

    O1 --> C1["users running\nnpm i llm-exe (latest)\nor npm i llm-exe@beta"]:::cons
    O2 --> C2["consumers verifying supply chain\nvia npm audit signatures"]:::cons
    O3 --> C3["GitHub Release feed,\ndependabot, downstream tools"]:::cons
    O4 --> C4["maintainer fixes issue,\nedits draft, republishes"]:::human
    O5 --> C4
```

[Back to top](#navigate)

---

## 10. State machine

A single run as a finite state machine.

```mermaid
stateDiagram-v2
    [*] --> Triggered: release.published or workflow_dispatch
    Triggered --> BranchChecking: check-release-branch job starts
    BranchChecking --> WrongBranch: target_commitish != main
    BranchChecking --> BranchOK: main OR dispatch (step skipped)
    WrongBranch --> [*]: workflow fails, no rollback
    BranchOK --> ExamplesRunning: run-examples-tests starts
    ExamplesRunning --> ExamplesFailed: test failure or build error
    ExamplesRunning --> ExamplesOK: all examples pass
    ExamplesFailed --> RollbackEligible: if release event
    ExamplesOK --> ActorChecking: publish-npm-package starts
    ActorChecking --> WrongActor: actor not in allowlist
    ActorChecking --> ActorOK: actor == gregreindel
    WrongActor --> RollbackEligible: if release event
    ActorOK --> Installing: setup-node + cache + npm install
    Installing --> InstallFailed: npm install error
    InstallFailed --> RollbackEligible
    Installing --> Building: npm run build:package
    Building --> BuildFailed: tsup error
    BuildFailed --> RollbackEligible
    Building --> Routing: read version, branch on '-' suffix
    Routing --> PublishingMain: no '-' (stable)
    Routing --> PublishingPreRelease: '-' with alphabetic channel
    Routing --> RefusedPreRelease: '-' with no alphabetic channel
    RefusedPreRelease --> PublishFailed: exit 1 (would clobber latest)
    PublishingMain --> PublishFailed: registry error
    PublishingPreRelease --> PublishFailed
    PublishingMain --> Published: 200 OK + provenance
    PublishingPreRelease --> Published: 200 OK on $TAG dist-tag
    PublishFailed --> RollbackEligible
    RollbackEligible --> Drafted: event_name == release, PATCH 200
    RollbackEligible --> DraftFailed: dispatch OR PATCH non-200
    Published --> [*]
    Drafted --> [*]
    DraftFailed --> [*]
```

Failure of the publish step is the only path that produces a partial outcome (tarball pushed but provenance failed). npm's transactional semantics make this rare in practice. Examples test failures are caught before any npm publish attempt.

[Back to top](#navigate)

---

## 11. Failure modes

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["Release cut from non-main branch\n(target_commitish != main)"]:::fail
    F1 --> F1E["check-release-branch exits 1\ndownstream jobs never start\nno rollback fires"]:::effect
    F1E --> F1X["delete/edit the release,\nrecreate it targeting main,\nor merge to main first"]:::fix

    F1b["Examples tests fail\n(provider error, test assertion, build error)"]:::fail
    F1b --> F1bE["run-examples-tests fails\npublish-npm-package never starts\nrollback fires on release event"]:::effect
    F1bE --> F1bX["check provider keys and examples,\nfix and rerun via dispatch"]:::fix

    F2["workflow_dispatch by non-allowed actor"]:::fail
    F2 --> F2E["Validate Publisher step exits 1\nbefore install or build"]:::effect
    F2X["edit ALLOWED_PUBLISHERS in workflow\nor request the owner to publish"]:::fix
    F2E --> F2X

    F3["npm install fails\n(lockfile drift, registry down)"]:::fail
    F3 --> F3E["job fails before build\nrollback fires on release event"]:::effect
    F3X["fix package-lock alignment,\nthen rerun via dispatch"]:::fix
    F3E --> F3X

    F4["build:package fails\n(type error, tsup error)"]:::fail
    F4 --> F4E["job fails before publish\nrollback fires on release event"]:::effect
    F4X["fix code, cut a new release\nor rerun dispatch after fix"]:::fix
    F4E --> F4X

    F5["npm publish fails\n(version already exists, auth, network)"]:::fail
    F5 --> F5E["job fails at publish step\nrollback fires on release event\ntarball NOT live"]:::effect
    F5X["bump version, recreate release\n(npm versions are immutable)"]:::fix
    F5E --> F5X

    F5b["Pre-release version with no alphabetic channel\n(e.g. 3.0.0-1234)"]:::fail
    F5b --> F5bE["publish step exits 1 before npm is called\nrollback fires on release event\ntarball NOT live"]:::effect
    F5bX["use a named channel (-beta.X, -rc.X, -alpha.X)\nrecut release after fixing package.json"]:::fix
    F5bE --> F5bX

    F6["OIDC provenance fails\nbut tarball already published"]:::fail
    F6 --> F6E["step exit non-zero,\nrollback flips release to draft,\nbut npm tarball is live"]:::effect
    F6X["unpublish within 72h or publish patch\nthat supersedes; investigate id-token perms"]:::fix
    F6E --> F6X

    F7["Rollback PATCH itself fails\n(bot token revoked, GitHub API down)"]:::fail
    F7 --> F7E["warning printed, response dumped\nrelease stays published\nworkflow still marked failed"]:::effect
    F7X["manually edit the release to draft\nadd warning banner by hand"]:::fix
    F7E --> F7X

    F8["Two simultaneous dispatch runs"]:::fail
    F8 --> F8E["no concurrency group;\nsecond run will fail at npm publish\n(version conflict)"]:::effect
    F8X["wait for first run,\nor add concurrency group if this recurs"]:::fix
    F8E --> F8X
```

[Back to top](#navigate)

---

## 12. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/publish-release.yml"]:::v
    K2["Triggers"]:::k --- V2["release.published + workflow_dispatch"]:::v
    K3["Jobs"]:::k --- V3["check-release-branch, run-examples-tests,\npublish-npm-package, revert-to-draft"]:::v
    K4["Permissions"]:::k --- V4["id-token: write, contents: write"]:::v
    K5["Branch guard"]:::k --- V5["release.target_commitish == 'main'"]:::v
    K6["Actor guard"]:::k --- V6["ALLOWED_PUBLISHERS = gregreindel"]:::v
    K6b["Examples tests"]:::k --- V6b["Node 22.x, Examples Test env,\nreal provider keys, npm run test-examples"]:::v
    K7["Node version (publish)"]:::k --- V7["24.x via ./.github/actions/setup-node"]:::v
    K8["Registry"]:::k --- V8["registry.npmjs.org"]:::v
    K9["Cache"]:::k --- V9["~/.npm and node_modules (composite)"]:::v
    K10["Build"]:::k --- V10["npm run build:package (tsup CJS+ESM+DTS)"]:::v
    K11["Publish (stable)"]:::k --- V11["npm run publish-main = npm publish --provenance (latest dist-tag)"]:::v
    K12["Publish (pre-release)"]:::k --- V12["npm publish --provenance --tag $CHANNEL (beta, rc, alpha, ...)"]:::v
    K13["Routing key"]:::k --- V13["first alphabetic chunk after '-' in package.json version; no '-' = stable; '-' without letters = refuse"]:::v
    K14["Provenance"]:::k --- V14["OIDC id-token, automatic on publish"]:::v
    K15["Bot identity"]:::k --- V15["llm-exe-bot[bot] via App token"]:::v
    K16["Rollback"]:::k --- V16["PATCH releases/:id draft=true, banner + original body"]:::v
    K17["Rollback condition"]:::k --- V17["always() && release event &&\n(examples failed || publish failed)"]:::v
    K18["Rollback job"]:::k --- V18["revert-to-draft (separate job,\nmints own bot token)"]:::v
```

Direct links:

- Workflow file: [.github/workflows/publish-release.yml](../workflows/publish-release.yml)
- Composite actions: [actions/setup-node](../actions/setup-node/action.yml), [actions/cache](../actions/cache/action.yml)
- Publish scripts: [package.json](../../package.json) lines 56-57
- Build script: [package.json](../../package.json) line 46 (`build:package`)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)

[Back to top](#navigate)
