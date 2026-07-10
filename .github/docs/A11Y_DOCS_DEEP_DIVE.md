# A11y Docs: Visual Deep Dive

Concentrated diagrams for [.github/workflows/a11y-docs.yml](../workflows/a11y-docs.yml). Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers](#2-triggers)
- [3. The single-job DAG](#3-the-single-job-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. Filesystem reads and writes](#5-filesystem-reads-and-writes)
- [6. External calls](#6-external-calls)
- [7. Security posture](#7-security-posture)
- [8. Output](#8-output)
- [9. Failure modes](#9-failure-modes)
- [10. Quick reference card](#10-quick-reference-card)

---

## 1. The whole picture

How [a11y-docs.yml](../workflows/a11y-docs.yml) plugs into everything (or rather, does not).

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        d1["workflow_dispatch\n(manual only)"]:::trig
    end

    subgraph A["a11y-docs.yml"]
        J["pa11y job\nubuntu-latest, timeout 15m"]:::job
    end

    subgraph F["Files read"]
        cfg["docs/ (VitePress source)"]:::file
        urls[".github/a11y/pa11yci.json\n(canonical URL list + Pa11y config)"]:::file
        cmp[".github/actions/setup-node/action.yml\n(Node 24 + npm cache)"]:::file
    end

    subgraph X["External"]
        npm["registry.npmjs.org\n(npm install + npx pa11y-ci + npx serve)"]:::ext
        loop["http://127.0.0.1:4173\n(loopback static server)"]:::ext
    end

    subgraph O["Outputs"]
        log["job log\n(pass/fail only; no PRs, no issues)"]:::out
    end

    d1 --> J
    J --> cmp
    J --> cfg
    J --> urls
    J --> npm
    J --> loop
    J --> O
```

Standalone workflow. It does not write to GitHub, does not commit, does not open PRs, does not fire any other workflow. Pass/fail is the entire output.

[Back to top](#navigate)

---

## 2. Triggers

One entry point, by design.

```mermaid
flowchart TB
    classDef manual fill:#9333ea,color:#fff,stroke:#000
    classDef future fill:#374151,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}
    ev -->|workflow_dispatch| run[pa11y job runs]:::manual
    ev -->|anything else| fail([no other trigger configured])

    note["Future plan (per file comment):\nflip to also run on pull_request paths\naffecting docs/** and .github/a11y/**\nonce URL list and baseline are stable"]:::future
```

The workflow file's comments document the intent: manual-only for now to let the canonical URL list and the Pa11y baseline stabilize. Once those are settled, add a `pull_request` trigger filtered to `docs/**` and `.github/a11y/**`.

Source: [.github/workflows/a11y-docs.yml](../workflows/a11y-docs.yml) lines 12-15.

[Back to top](#navigate)

---

## 3. The single-job DAG

One job, six steps, no fan-out.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000

    start([workflow_dispatch])
    start --> J

    subgraph J["Job: pa11y (ubuntu-latest, timeout 15m)"]
        direction TB
        s1["actions/checkout@v5"]:::step
        s2["./.github/actions/setup-node\n(Node 24, cache: npm)"]:::step
        s3["npm install"]:::step
        s4["npm run docs:update-providers\n&& npm run docs:build (auto postdocs:build guard)"]:::step
        s5["serve docs/.vitepress/dist on :4173\nbackgrounded; poll up to 30s"]:::step
        s6["npx pa11y-ci@3\n--config .github/a11y/pa11yci.json"]:::step
        s7["Stop the static server\n(if: always())"]:::step
        s1 --> s2 --> s3 --> s4 --> s5 --> s6 --> s7
    end
```

No concurrency group is configured. Two concurrent dispatches would run side by side. Since the job binds to a fixed local port inside its own runner, that is fine.

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

One run from dispatch to exit.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event
    participant J as pa11y job
    participant G as Git
    participant N as Node + npm
    participant V as VitePress build
    participant S as npx serve@14 (loopback :4173)
    participant P as npx pa11y-ci@3
    participant CFG as .github/a11y/pa11yci.json

    E->>J: workflow_dispatch
    J->>G: checkout@v5 (default token, read-only)
    J->>N: setup-node@v6 via composite (node 24, cache npm)
    J->>N: npm install
    J->>V: npm run docs:update-providers + npm run docs:build
    V->>V: postdocs:build guard (verify-docs-build.mjs checks sitemap)
    V-->>J: docs/.vitepress/dist
    J->>S: spawn serve@14 dist -l 4173 (background)
    Note over J,S: poll http://127.0.0.1:4173/ for up to 30 seconds
    S-->>J: 200 OK
    J->>P: npx pa11y-ci@3 --config CFG
    P->>CFG: read URL list and Pa11y config
    P->>S: HTTP fetches against loopback
    P-->>J: accessibility report; exit code drives job outcome
    J->>S: kill pid in /tmp/serve.pid (if: always())
```

Source: [.github/workflows/a11y-docs.yml](../workflows/a11y-docs.yml) lines 20-60.

[Back to top](#navigate)

---

## 5. Filesystem reads and writes

Color: blue is read, orange is write. Why each one exists.

```mermaid
flowchart LR
    classDef read fill:#1e3a8a,color:#fff,stroke:#000
    classDef write fill:#9a3412,color:#fff,stroke:#000
    classDef tmp fill:#374151,color:#fff,stroke:#000

    subgraph reads["READ"]
        r1["docs/\nVitePress source"]:::read
        r2[".github/a11y/pa11yci.json\nPa11y CI config + URL list"]:::read
        r3[".github/actions/setup-node/action.yml\nshared composite (Node 24)"]:::read
        r4["package.json\nresolves docs scripts"]:::read
    end

    subgraph writes["WRITE"]
        w1["docs/.vitepress/dist\nbuilt site, runner-local"]:::write
        w2["/tmp/serve.log\nstdout/stderr from serve"]:::tmp
        w3["/tmp/serve.pid\nbackground server pid"]:::tmp
    end

    r1 --> w1
    r4 --> w1
```

Nothing here is committed. Everything written is ephemeral runner state.

[Back to top](#navigate)

---

## 6. External calls

Who is contacted, with what credential, why.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef pkg fill:#1f2937,color:#fff,stroke:#000
    classDef loop fill:#064e3b,color:#fff,stroke:#000

    subgraph Pre["Before the job runs"]
        c1["actions/checkout@v5\nauth: GITHUB_TOKEN (read-only)\nwhy: pull docs/ and a11y/ at HEAD"]:::pre
        c2["./.github/actions/setup-node\nauth: none\nwhy: install Node 24, prime npm cache"]:::pre
    end

    subgraph During["While the job runs"]
        d1["registry.npmjs.org\nauth: anonymous\nwhy: npm install, npx serve@14, npx pa11y-ci@3"]:::pkg
        d2["http://127.0.0.1:4173\nauth: none, loopback only\nwhy: built docs served for Pa11y to scan"]:::loop
    end

    c1 --> c2
    c2 --> d1
    d1 --> d2
```

No App token. No bot identity. No Anthropic call. No `gh` writes. The job is pure CI verification.

[Back to top](#navigate)

---

## 7. Security posture

Why this workflow has a tiny attack surface.

```mermaid
flowchart TB
    classDef good fill:#064e3b,color:#fff,stroke:#000
    classDef neutral fill:#374151,color:#fff,stroke:#000

    G1["permissions: contents: read\nno write capability at all"]:::good
    G2["no github.event.* interpolation\nin run: blocks"]:::good
    G3["URL list is committed under .github/a11y/\nnot user-controlled"]:::good
    G4["loopback only (127.0.0.1:4173)\nno public endpoint, no inbound"]:::good
    G5["no secrets referenced\nno provider keys, no App token"]:::good
    N1["external network: registry.npmjs.org\n(npm + npx download)"]:::neutral
```

Source comment at the top of the workflow file explicitly calls this out: "this workflow does not consume any user-controlled `github.event.*` input inside `run:` blocks." Path filters are not yet enabled because the trigger is manual-only.

[Back to top](#navigate)

---

## 8. Output

What the run produces.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    AR["a11y-docs.yml\nrun completes"]:::src
    AR --> O1["job exit code\n(0 = clean, non-zero = a11y issues found)"]:::out
    AR --> O2["pa11y-ci stdout in the run log\n(one section per scanned URL)"]:::out
    AR -.no PR.-> X1["does not open PRs"]:::out
    AR -.no issue.-> X2["does not file issues"]:::out
    AR -.no commit.-> X3["does not commit anything"]:::out
```

Pass/fail is the entire output. The maintainer reads the Actions tab to see which URLs failed Pa11y.

[Back to top](#navigate)

---

## 9. Failure modes

Where things break, what happens.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["npm install fails"]:::fail
    F1 --> F1E["job fails before build step"]:::effect
    F1E --> F1X["check package-lock alignment; rerun"]:::fix

    F2["docs build fails\n(VitePress error, or postdocs:build\nguard rejects an incomplete sitemap)"]:::fail
    F2 --> F2E["no dist/ produced; serve step fails"]:::effect
    F2E --> F2X["reproduce locally with npm run docs:build"]:::fix

    F3["serve does not come up in 30s"]:::fail
    F3 --> F3E["job prints /tmp/serve.log and exits 1"]:::effect
    F3E --> F3X["inspect log for port conflict or build artifact issue"]:::fix

    F4["Pa11y finds a11y issues"]:::fail
    F4 --> F4E["pa11y-ci exits non-zero; job fails"]:::effect
    F4E --> F4X["maintainer triages: fix docs/ source or update the baseline"]:::fix

    F5["Job exceeds 15-minute timeout"]:::fail
    F5 --> F5E["runner kills the step\nstop-server step still runs (if: always())"]:::effect
    F5E --> F5X["unusual - profile docs build size or Pa11y URL count"]:::fix
```

[Back to top](#navigate)

---

## 10. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/a11y-docs.yml"]:::v
    K2["Name"]:::k --- V2["Docs / Accessibility"]:::v
    K3["Triggers"]:::k --- V3["workflow_dispatch only"]:::v
    K4["Permissions"]:::k --- V4["contents: read"]:::v
    K5["Timeout"]:::k --- V5["15 minutes"]:::v
    K6["Concurrency"]:::k --- V6["not set"]:::v
    K7["Identity"]:::k --- V7["default GITHUB_TOKEN (read-only)"]:::v
    K8["Runner"]:::k --- V8["ubuntu-latest"]:::v
    K9["Node version"]:::k --- V9["24 (via composite setup-node)"]:::v
    K10["Build commands"]:::k --- V10["npm run docs:update-providers && npm run docs:build (auto postdocs:build guard)"]:::v
    K11["Static server"]:::k --- V11["npx serve@14 docs/.vitepress/dist -l 4173"]:::v
    K12["Scanner"]:::k --- V12["npx pa11y-ci@3"]:::v
    K13["Config file"]:::k --- V13[".github/a11y/pa11yci.json"]:::v
    K14["Network in"]:::k --- V14["none (loopback only)"]:::v
    K15["Network out"]:::k --- V15["registry.npmjs.org"]:::v
    K16["Output"]:::k --- V16["pass/fail (no PRs, no issues)"]:::v
```

Direct links:

- Workflow file: [.github/workflows/a11y-docs.yml](../workflows/a11y-docs.yml)
- Pa11y config: [.github/a11y/pa11yci.json](../a11y/pa11yci.json)
- Composite action: [setup-node](../actions/setup-node/action.yml)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)

[Back to top](#navigate)
