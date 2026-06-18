# check-semantic-versioning: Visual Deep Dive

Concentrated diagrams for [.github/workflows/check-semantic-versioning.yml](../workflows/check-semantic-versioning.yml). The workflow itself is one job and six steps, but its **status check** is a hard gate inside the release pipeline. Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers](#2-triggers)
- [3. The one-job DAG](#3-the-one-job-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. The version comparison algorithm](#5-the-version-comparison-algorithm)
- [6. Output cascade](#6-output-cascade)
- [7. Why this exists](#7-why-this-exists)
- [8. Failure modes](#8-failure-modes)
- [9. Quick reference card](#9-quick-reference-card)

---

## 1. The whole picture

A tiny workflow with an outsized role. It guards every PR that targets `main`, and its **completion event** is what wakes up [auto-merge-main-pr.yml](../workflows/auto-merge-main-pr.yml).

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000

    subgraph T["Trigger"]
        t1["pull_request\nbranches: main"]:::trig
    end

    subgraph W["check-semantic-versioning.yml"]
        J["enforce-semantic-version\n(single job, ubuntu-latest)"]:::job
    end

    subgraph R["Repo inputs"]
        f1["git tags\n(fetched with --tags)"]:::file
        f2["package.json\n.version field"]:::file
    end

    subgraph O["Outputs"]
        o1["status check\nname: Release / Check Semver"]:::out
        o2["exit 0\n(version bumped)"]:::out
        o3["exit 1\n(version stale or equal)"]:::out
    end

    subgraph D["Downstream consumer"]
        d1["auto-merge-main-pr.yml\nworkflow_run on this workflow's name"]:::cons
        d2["branch protection\non main (status check required)"]:::cons
    end

    t1 --> J
    f1 --> J
    f2 --> J
    J --> o1
    J --> o2
    J --> o3
    o1 --> d1
    o1 --> d2
```

The string `Release / Check Semver` (the `name:` at the top of the YAML) is **the contract**. Both `auto-merge-main-pr.yml` (via `workflow_run.workflows`) and any branch protection rule on `main` reference that exact string. Renaming the workflow breaks the release pipeline silently.

[Back to top](#navigate)

---

## 2. Triggers

One trigger. No cron, no dispatch, no push. The workflow only exists in the context of an open PR aiming at `main`.

```mermaid
flowchart TB
    classDef ev fill:#0e7490,color:#fff,stroke:#000
    classDef skip fill:#374151,color:#fff,stroke:#000
    classDef run fill:#1e3a8a,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|pull_request| br{base ref?}
    ev -->|push| skip1([ignored, no push trigger]):::skip
    ev -->|schedule| skip2([ignored, no cron]):::skip
    ev -->|workflow_dispatch| skip3([ignored, no dispatch]):::skip

    br -->|main| go([run the job]):::run
    br -->|development or other| skip4([ignored, branch filter]):::skip
```

Concurrency: `${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`. Force-pushes to a PR cancel the in-flight check and start a fresh one. Two different PRs run in parallel (different `github.ref`).

Permissions: `id-token: write`, `contents: read`. No bot token. No write scopes. The job only reads the repo and reports a status.

[Back to top](#navigate)

---

## 3. The one-job DAG

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000

    start([pull_request to main])
    start --> J

    subgraph J["Job: enforce-semantic-version (ubuntu-latest)"]
        direction TB
        s1["actions/checkout@v6"]:::step
        s2["git fetch --tags"]:::step
        s3["Get latest stable release tag\n(regex + sort + head)"]:::step
        s4["Get version from package.json\n(jq -r .version)"]:::step
        s5["Compare versions\nawk numeric form"]:::gate
        s6["Success message\n(if: success())"]:::step
        s1 --> s2 --> s3 --> s4 --> s5 --> s6
    end

    s5 -->|exit 0| pass([status: success])
    s5 -->|exit 1| fail([status: failure])
```

No matrix. No artifacts. No cache. No external network calls beyond the checkout itself. Total runtime is a few seconds on a warm runner.

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

One run, end to end, with every input and output noted.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event (pull_request)
    participant R as Runner
    participant CO as actions/checkout@v6
    participant G as git
    participant TAG as Tag list
    participant PJ as package.json
    participant AWK as awk numeric form
    participant ST as Status check

    E->>R: pull_request opened or synchronize, base=main
    R->>CO: clone repo at PR head
    CO-->>R: working tree ready
    R->>G: git fetch --tags
    G-->>R: all remote tags pulled local
    R->>TAG: git tag --sort=-v:refname filtered by regex ^v[0-9]+.[0-9]+.[0-9]+$
    TAG-->>R: LATEST_TAG (or v0.0.0 fallback)
    Note over R: strip leading v, export LATEST_TAG to GITHUB_ENV
    R->>PJ: jq -r .version package.json
    PJ-->>R: PACKAGE_VERSION exported to GITHUB_ENV
    R->>AWK: convert_version on each (printf %d%03d%03d)
    AWK-->>R: two 9-digit ints
    R->>R: bash arithmetic test PACKAGE_VERSION_NUM le LATEST_TAG_NUM
    alt PACKAGE_VERSION_NUM le LATEST_TAG_NUM
        R->>ST: exit 1, status = failure
    else PACKAGE_VERSION_NUM gt LATEST_TAG_NUM
        R->>ST: exit 0, run Success message step
        ST-->>E: status = success on PR head sha
    end
```

Source: [.github/workflows/check-semantic-versioning.yml](../workflows/check-semantic-versioning.yml) lines 16-62.

[Back to top](#navigate)

---

## 5. The version comparison algorithm

The heart of the workflow. Three transformations: regex parse, numeric pack, integer compare.

```mermaid
flowchart TB
    classDef in fill:#0e7490,color:#fff,stroke:#000
    classDef tx fill:#374151,color:#fff,stroke:#000
    classDef dec fill:#7c2d12,color:#fff,stroke:#000
    classDef ok fill:#064e3b,color:#fff,stroke:#000
    classDef bad fill:#581c87,color:#fff,stroke:#000

    A1["git tag --sort=-v:refname"]:::in
    A2["grep -E '^v[0-9]+\\.[0-9]+\\.[0-9]+$'\nrejects pre-release tags like v2.3.0-rc1"]:::tx
    A3["head -n 1\ntake the highest stable"]:::tx
    A4{any match?}:::dec
    A4 -->|no| A5["LATEST_TAG=v0.0.0 fallback"]:::tx
    A4 -->|yes| A6["LATEST_TAG = matched tag"]:::tx
    A5 --> A7["strip leading v"]:::tx
    A6 --> A7

    B1["jq -r '.version' package.json"]:::in
    B1 --> B2["PACKAGE_VERSION (string X.Y.Z)"]:::tx

    A7 --> C1
    B2 --> C1
    C1["convert_version()\nawk -F. '{ printf %d%03d%03d $1 $2 $3 }'"]:::tx
    C1 --> C2["LATEST_TAG_NUM (9-digit int)"]:::tx
    C1 --> C3["PACKAGE_VERSION_NUM (9-digit int)"]:::tx

    A1 --> A2 --> A3 --> A4
    C2 --> D1{"PACKAGE_VERSION_NUM &lt;= LATEST_TAG_NUM?"}:::dec
    C3 --> D1
    D1 -->|yes| F["exit 1: package.json not bumped"]:::bad
    D1 -->|no| P["exit 0: bump confirmed"]:::ok
```

Worked example with `LATEST_TAG=v2.3.7` and `package.json` at `2.4.0`:

| Step | LATEST | PACKAGE |
|------|--------|---------|
| Raw string | `2.3.7` | `2.4.0` |
| `awk -F. '{ printf("%d%03d%03d", $1,$2,$3); }'` | `2003007` | `2004000` |
| Bash compare `PACKAGE_VERSION_NUM -le LATEST_TAG_NUM` | `2004000 -le 2003007` is false | proceed, exit 0 |

Why pack into `%d%03d%03d`? Bash's `[ a -le b ]` is integer-only; it cannot compare `2.4.0` and `2.3.7` as strings. The pack collapses three components into one monotonically increasing integer for the minor/patch range `0..999`.

**Bounds**: minor or patch above 999 would overflow into the next slot and produce wrong answers. At current release cadence this is hypothetical, but it is a real ceiling baked into the algorithm.

**Pre-release exclusion**: the regex `^v[0-9]+\.[0-9]+\.[0-9]+$` is anchored at both ends, so tags like `v2.4.0-rc1` or `v2.4.0+build.5` are filtered out. Only stable releases set the floor.

[Back to top](#navigate)

---

## 6. Output cascade

The job emits a single observable thing: a status check named `Release / Check Semver` on the PR head SHA. Two consumers care.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    SV["check-semantic-versioning.yml\nrun completes"]:::src
    SV --> O1["status check\nname: 'Release / Check Semver'\nconclusion: success | failure"]:::out

    O1 --> C1["auto-merge-main-pr.yml\non: workflow_run\nworkflows: ['Release / Check Semver']\ntypes: [completed]"]:::cons
    O1 --> C2["branch protection on main\n(required status check)"]:::cons
    O1 --> C3["PR UI red/green badge"]:::human

    C1 --> G1{conclusion == 'success'\nAND head_branch == 'development'?}:::cons
    G1 -->|yes| AM["auto-merge job runs\ngh pr merge --squash"]:::cons
    G1 -->|no| SK([no-op, wait for next event]):::human

    C2 --> M{required check passed?}:::cons
    M -->|yes| RDY["merge button enabled"]:::human
    M -->|no| BLK["merge blocked"]:::human
```

The coupling is **by name string**, not by file path or workflow ID. `auto-merge-main-pr.yml` declares:

```yaml
on:
  workflow_run:
    workflows:
      - "Release / Check Semver"
    types:
      - completed
```

Change line 1 of `check-semantic-versioning.yml` (`name: Release / Check Semver`) and the auto-merge trigger goes silent without any GitHub-side error.

[Back to top](#navigate)

---

## 7. Why this exists

Release discipline at the merge boundary. The repo follows semver and publishes from `main`. If `package.json` is not bumped before the dev-to-main merge, the next publish either fails (npm rejects republish of an existing version) or silently overwrites a published version. Both are bad.

```mermaid
flowchart LR
    classDef good fill:#064e3b,color:#fff,stroke:#000
    classDef bad fill:#7c2d12,color:#fff,stroke:#000
    classDef gate fill:#1e3a8a,color:#fff,stroke:#000

    DEV["development branch\nfeatures merged in"]:::good
    DEV --> PR["dev-to-main PR\n(draft from draft-main-pr.yml)"]:::good
    PR --> CHK["check-semantic-versioning"]:::gate
    CHK -->|version bumped| PASS["status: success\nauto-merge eligible\npublish-release can tag and ship"]:::good
    CHK -->|version stale| FAIL["status: failure\nmerge blocked\nmaintainer must bump package.json"]:::bad
```

The check is **cheap, fast, and deterministic**. It is also the only place in the pipeline that enforces a version bump. Without it, the rest of the release machinery (`publish-release.yml`, `create-draft-release.yml`, `pack-package.yml`) would still run, but on a duplicate version.

[Back to top](#navigate)

---

## 8. Failure modes

Small workflow, small failure surface. But every failure here blocks a release.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["package.json version not bumped\n(equals latest tag)"]:::fail
    F1 --> F1E["exit 1, status=failure\nPR merge blocked"]:::effect
    F1E --> F1X["bump package.json to next semver\npatch/minor/major per change"]:::fix

    F2["package.json version went backward\n(lower than latest tag)"]:::fail
    F2 --> F2E["exit 1, status=failure"]:::effect
    F2E --> F2X["correct the version forward"]:::fix

    F3["No matching tag exists yet\n(fresh repo or all tags pre-release)"]:::fail
    F3 --> F3E["LATEST_TAG fallback to v0.0.0\nany 0.0.x or higher passes"]:::effect
    F3E --> F3X["intentional bootstrap behavior"]:::fix

    F4["Minor or patch &gt;= 1000"]:::fail
    F4 --> F4E["awk pack overflows the field\nfalse compare result possible"]:::effect
    F4X["replace pack with sort -V or a real semver tool"]:::fix
    F4E --> F4X

    F5["package.json has non-X.Y.Z version\n(e.g. 2.4.0-beta.1)"]:::fail
    F5 --> F5E["awk splits on . but treats trailing junk\nresult may pack incorrectly"]:::effect
    F5X["pre-release tags not part of this repo's flow\nfix is to keep package.json stable-only"]:::fix
    F5E --> F5X

    F6["Workflow renamed in YAML"]:::fail
    F6 --> F6E["auto-merge-main-pr.yml workflow_run\nno longer matches\nbranch protection check name drifts"]:::effect
    F6X["keep 'Release / Check Semver' verbatim\nor update all consumers together"]:::fix
    F6E --> F6X

    F7["Concurrency cancels mid-run\n(force-push to PR)"]:::fail
    F7 --> F7E["status check shows cancelled\nGitHub re-runs on new sha"]:::effect
    F7X["intentional: cancel-in-progress: true"]:::fix
    F7E --> F7X

    F8["git fetch --tags fails\n(network or auth)"]:::fail
    F8 --> F8E["step exits non-zero\njob marked failed"]:::effect
    F8X["transient, re-run the job"]:::fix
    F8E --> F8X
```

[Back to top](#navigate)

---

## 9. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/check-semantic-versioning.yml"]:::v
    K2["Workflow name"]:::k --- V2["Release / Check Semver"]:::v
    K3["Triggers"]:::k --- V3["pull_request, branches: main"]:::v
    K4["Permissions"]:::k --- V4["id-token: write, contents: read"]:::v
    K5["Concurrency"]:::k --- V5["workflow + ref, cancel-in-progress: true"]:::v
    K6["Runner"]:::k --- V6["ubuntu-latest"]:::v
    K7["Jobs"]:::k --- V7["1 (enforce-semantic-version)"]:::v
    K8["Steps"]:::k --- V8["checkout, fetch tags, get tag, get pkg version, compare, success msg"]:::v
    K9["Tag regex"]:::k --- V9["^v[0-9]+\\.[0-9]+\\.[0-9]+$ (stable only)"]:::v
    K10["Fallback tag"]:::k --- V10["v0.0.0 if no tag matches"]:::v
    K11["Compare"]:::k --- V11["awk pack %d%03d%03d, bash -le"]:::v
    K12["Pass rule"]:::k --- V12["package.json version &gt; latest stable tag"]:::v
    K13["Bot token?"]:::k --- V13["no (read-only)"]:::v
    K14["Downstream"]:::k --- V14["auto-merge-main-pr.yml (workflow_run by name)"]:::v
    K15["Branch protection"]:::k --- V15["status check name is load-bearing"]:::v
```

Direct links:

- Workflow file: [.github/workflows/check-semantic-versioning.yml](../workflows/check-semantic-versioning.yml)
- Downstream consumer: [.github/workflows/auto-merge-main-pr.yml](../workflows/auto-merge-main-pr.yml)
- Release siblings: [draft-main-pr.yml](../workflows/draft-main-pr.yml), [create-draft-release.yml](../workflows/create-draft-release.yml), [publish-release.yml](../workflows/publish-release.yml)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)

[Back to top](#navigate)
