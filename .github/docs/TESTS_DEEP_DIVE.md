# tests: Visual Deep Dive

Concentrated diagrams for [.github/workflows/tests.yml](../workflows/tests.yml). Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

Short workflow, but it gates every PR. Worth understanding.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers](#2-triggers)
- [3. The matrix DAG](#3-the-matrix-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. The cache strategy](#5-the-cache-strategy)
- [6. External calls](#6-external-calls)
- [7. Output cascade](#7-output-cascade)
- [8. Failure modes](#8-failure-modes)
- [9. Quick reference card](#9-quick-reference-card)

---

## 1. The whole picture

How [tests.yml](../workflows/tests.yml) plugs into the rest of the system.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        t1["pull_request\nbase: main"]:::trig
        t2["workflow_dispatch\n(manual)"]:::trig
        t3["push\nbranches: main"]:::trig
    end

    subgraph A["tests.yml"]
        BY["bypass check\nhead_ref == bump-version-branch?"]:::gate
        M["matrix: node 18/20/22/24\nfail-fast: false"]:::job
    end

    subgraph C["Caches"]
        c1["setup-node built-in\n(npm cache)"]:::out
        c2["./.github/actions/cache\n~/.npm + node_modules\nkeyed on matrix.node-version"]:::out
    end

    subgraph X["External"]
        cov["coveralls.io\n(Node 24.x only)"]:::ext
    end

    subgraph O["Outputs"]
        sc["CI / Tests status check\n(per matrix leg)"]:::out
        rep["coveralls coverage report"]:::out
    end

    subgraph D["Downstream"]
        am["auto-merge-main-pr.yml\nwaits on CI / Tests"]:::job
        rev["code review on PR"]:::job
    end

    t1 --> BY
    t2 --> BY
    t3 --> BY
    BY -->|not bump-version-branch| M
    BY -.->|bump-version-branch on development| skip(["job skipped"])
    M --> c1
    M --> c2
    M --> sc
    M -->|node 24.x| cov
    cov --> rep
    sc --> am
    sc --> rev
```

[Back to top](#navigate)

---

## 2. Triggers

Three entry points. All go through one bypass gate.

```mermaid
flowchart TB
    classDef pr fill:#0e7490,color:#fff,stroke:#000
    classDef manual fill:#9333ea,color:#fff,stroke:#000
    classDef push fill:#0f766e,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|pull_request| pr1{base.ref == main?}
    ev -->|workflow_dispatch| disp[manual run, no filter]:::manual
    ev -->|push| pu1{ref == refs/heads/main?}:::push

    pr1 -->|main| bypass
    pr1 -->|other| ignore([workflow not triggered])

    pu1 -->|main| bypass
    pu1 -->|other| ignore

    disp --> bypass

    bypass{head_ref == bump-version-branch\nAND base == development?}:::gate
    bypass -->|yes| skipJob([job condition false, all matrix legs skipped]):::out
    bypass -->|no| runJob([matrix runs across 4 node versions]):::out
```

The bypass exists so release version-bump PRs don't re-run the suite that already passed on the source branch. It checks `base == development AND head == bump-version-branch` as a pair, so a stray branch named `bump-version-branch` targeting main still runs. On `push` and `workflow_dispatch` events `pull_request` is null, so the bypass evaluates to false and the matrix always runs.

The `push` trigger on `main` exists for Coveralls: the docs-site badge filters with `?branch=main`, so without a coverage upload tagged for `main` the badge renders "unknown". Every prior upload was tagged with the PR head branch (development / feature branches). Pushing to `main` (always via `auto-merge-main-pr.yml`) now produces one Coveralls record tagged for `main`, on the Node 24.x leg.

Source: [.github/workflows/tests.yml](../workflows/tests.yml) lines 3-12 (triggers) and line 22 (bypass `if`).

Note: tests for PRs targeting `development` are now handled by [agent-review-pr.yml](../workflows/agent-review-pr.yml), which runs a parallel test matrix on opened and synchronize events.

[Back to top](#navigate)

---

## 3. The matrix DAG

Four parallel legs. Independent. No fail-fast.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000

    start([Workflow event passes bypass])
    start --> fanout{matrix.node-version}

    fanout --> N18[CI / Tests<br/>node 18.x]:::job
    fanout --> N20[CI / Tests<br/>node 20.x]:::job
    fanout --> N22[CI / Tests<br/>node 22.x]:::job
    fanout --> N24[CI / Tests<br/>node 24.x]:::job

    N18 --> S18[6 steps]:::step
    N20 --> S20[6 steps]:::step
    N22 --> S22[6 steps]:::step
    N24 --> S24[7 steps<br/>+ Coverage]:::step

    S18 --> done([4 independent status checks])
    S20 --> done
    S22 --> done
    S24 --> done
```

`fail-fast: false` means one Node version failing does not cancel the others. You always see the full picture across Node 18/20/22/24, which is what you want for a library that declares `engines.node >= 18`.

Concurrency group is `${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`. Push a new commit to the same PR and the in-flight run dies so the new one can take over.

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

One matrix leg from event to status check.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event
    participant R as Runner (ubuntu-latest)
    participant CO as actions/checkout@v4
    participant SN as actions/setup-node@v4
    participant CA as ./.github/actions/cache
    participant NPM as npm
    participant J as Jest
    participant CV as coveralls

    E->>R: matrix leg starts (node 18/20/22/24)
    R->>CO: actions/checkout@v4
    CO-->>R: working tree at PR HEAD
    R->>SN: setup-node@v4, node-version, cache: npm
    SN-->>R: node + npm installed, ~/.npm primed
    R->>CA: composite cache action
    CA-->>R: ~/.npm and node_modules restored if hit
    R->>NPM: npm install (not ci)
    NPM-->>R: node_modules ready
    R->>J: npm run test (Jest with coverage, forceExit)
    J-->>R: pass / fail, coverage/ written
    Note over R: only if matrix.node-version == 24.x
    R->>CV: coverallsapp/github-action@v1
    CV-->>R: report uploaded
    R-->>E: status check returned to PR
```

The Coverage step uses `if: ${{ matrix.node-version == '24.x' }}` so it runs exactly once per workflow run, on the newest Node. The other three legs skip it.

Source: [.github/workflows/tests.yml](../workflows/tests.yml) lines 27-47.

[Back to top](#navigate)

---

## 5. The cache strategy

Two layers of caching, restored in order. They overlap intentionally.

```mermaid
flowchart LR
    classDef builtin fill:#155e75,color:#fff,stroke:#000
    classDef comp fill:#7c2d12,color:#fff,stroke:#000
    classDef path fill:#374151,color:#fff,stroke:#000
    classDef key fill:#581c87,color:#fff,stroke:#000

    subgraph L1["Layer 1: setup-node@v4 (cache: npm)"]
        l1act["actions/setup-node@v4"]:::builtin
        l1path["~/.npm"]:::path
        l1key["key: hash of package-lock.json"]:::key
        l1act --> l1path
        l1act --> l1key
    end

    subgraph L2["Layer 2: ./.github/actions/cache (composite)"]
        l2a["actions/cache@v4 (entry A)"]:::comp
        l2b["actions/cache@v4 (entry B)"]:::comp
        l2ap["~/.npm"]:::path
        l2bp["node_modules"]:::path
        l2ak["os-node-{matrix.node-version}-hash(package.json)"]:::key
        l2bk["os-nodeModules-{matrix.node-version}-hash(package.json)"]:::key
        l2a --> l2ap
        l2a --> l2ak
        l2b --> l2bp
        l2b --> l2bk
    end

    L1 --> L2
    L2 --> npmi[npm install]
```

Two things to know:

1. The composite action keys on `hashFiles('**/package.json')`, not `package-lock.json`. setup-node's built-in cache keys on `package-lock.json`. They are not redundant, they target different miss patterns.
2. `npm install` (not `npm ci`) means the workflow will reconcile the lockfile if it drifts from `package.json`. This is intentional given the multi-version matrix but trades strictness for resilience.

Source: [.github/actions/cache/action.yml](../actions/cache/action.yml).

[Back to top](#navigate)

---

## 6. External calls

```mermaid
flowchart LR
    classDef setup fill:#155e75,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef auth fill:#374151,color:#fff,stroke:#000

    subgraph Setup
        s1["actions/checkout@v4\nauth: GITHUB_TOKEN\nwhy: get PR HEAD"]:::setup
        s2["actions/setup-node@v4\nauth: none\nwhy: install Node, prime npm cache"]:::setup
        s3["actions/cache@v4 (x2)\nauth: GITHUB_TOKEN\nwhy: persist deps across runs"]:::setup
    end

    subgraph Runtime
        r1["npm registry (registry.npmjs.org)\nauth: anonymous\nwhy: resolve and download deps"]:::ext
        r2["coveralls.io\nauth: GITHUB_TOKEN\nwhy: upload coverage report"]:::ext
    end

    s1 --> s2 --> s3 --> r1
    r1 --> r2
```

`coverallsapp/github-action@v1` reads `lcov.info` from the default coverage output path. Jest writes coverage under `coverage/` thanks to the `--coverage` flag in the test script.

[Back to top](#navigate)

---

## 7. Output cascade

What this workflow produces and who consumes it.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    TST["tests.yml\nrun completes"]:::src

    TST --> O1["CI / Tests status check\n(one per matrix leg, 4 total)"]:::out
    TST --> O2["coveralls report\n(Node 24.x only)\ntagged by triggering branch"]:::out

    O1 --> C1["auto-merge-main-pr.yml\nblocks until CI / Tests is green"]:::cons
    O1 --> C2["branch protection on main / development\nrequires CI / Tests passing"]:::cons
    O1 --> C3["maintainer / reviewer\nlooks at red/green in PR UI"]:::human

    O2 --> C4["coveralls badge on docs site\nfilters with ?branch=main\n(requires push trigger)"]:::cons
    O2 --> C5["PR comment from coverallsapp\nwith line-level diff"]:::cons
```

Branch protection treats `CI / Tests` (per Node version) as a required check. The bypass at the job-level `if` produces "skipped" status, not "passed", so a bypassed run on `bump-version-branch` PRs relies on the protection rules being configured to accept skipped or to exempt that branch.

[Back to top](#navigate)

---

## 8. Failure modes

Where this breaks, what happens, what to do.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["Tests fail on one Node version only"]:::fail
    F1 --> F1E["fail-fast: false, other legs finish\nstatus check red on that leg"]:::effect
    F1E --> F1X["check version-specific API, polyfill, or engines bound"]:::fix

    F2["Cache restore returns stale node_modules"]:::fail
    F2 --> F2E["npm install reconciles\nslower install, still correct"]:::effect
    F2X["self-heals next run, no action needed"]:::fix
    F2E --> F2X

    F3["package.json updated but lockfile not"]:::fail
    F3 --> F3E["npm install rewrites lockfile in CI\nno error, but drift hidden"]:::effect
    F3X["run npm install locally and commit lockfile"]:::fix
    F3E --> F3X

    F4["Coveralls upload times out"]:::fail
    F4 --> F4E["Coverage step fails on Node 24.x leg only\ntests already passed"]:::effect
    F4X["re-run that leg, or accept (tests are the real gate)"]:::fix
    F4E --> F4X

    F5["Concurrent push cancels in-flight run"]:::fail
    F5 --> F5E["cancel-in-progress: true\nold run dies, new one takes over"]:::effect
    F5X["intentional, saves runner minutes"]:::fix
    F5E --> F5X

    F6["bump-version-branch PR opened against main"]:::fail
    F6 --> F6E["bypass requires base == development\nso tests DO run here"]:::effect
    F6X["intentional, main is the strict gate"]:::fix
    F6E --> F6X

    F7["Jest hangs (open handle)"]:::fail
    F7 --> F7E["--forceExit + --detectOpenHandles\nflags from package.json kick in"]:::effect
    F7X["look at known issue in CLAUDE.md\nasyncCallWithTimeout test"]:::fix
    F7E --> F7X
```

Source for test command: [package.json](../../package.json) line 39.

[Back to top](#navigate)

---

## 9. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/tests.yml"]:::v
    K2["Triggers"]:::k --- V2["pull_request (main) + push (main) + workflow_dispatch"]:::v
    K3["Bypass"]:::k --- V3["head==bump-version-branch AND base==development"]:::v
    K4["Runner"]:::k --- V4["ubuntu-latest"]:::v
    K5["Matrix"]:::k --- V5["node 18.x, 20.x, 22.x, 24.x"]:::v
    K6["fail-fast"]:::k --- V6["false (all legs run)"]:::v
    K7["Concurrency"]:::k --- V7["workflow + ref, cancel-in-progress: true"]:::v
    K8["Install"]:::k --- V8["npm install (not ci)"]:::v
    K9["Test"]:::k --- V9["npm run test (Jest, coverage, forceExit)"]:::v
    K10["Cache layer 1"]:::k --- V10["setup-node built-in (~/.npm by lockfile hash)"]:::v
    K11["Cache layer 2"]:::k --- V11["composite (~/.npm + node_modules by package.json hash)"]:::v
    K12["Coverage upload"]:::k --- V12["coverallsapp/github-action@v1, Node 24.x only"]:::v
    K13["Status checks"]:::k --- V13["one per matrix leg, required by branch protection"]:::v
```

Direct links:

- Workflow file: [.github/workflows/tests.yml](../workflows/tests.yml)
- Composite cache action: [.github/actions/cache/action.yml](../actions/cache/action.yml)
- Test script source: [package.json](../../package.json)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)

[Back to top](#navigate)
