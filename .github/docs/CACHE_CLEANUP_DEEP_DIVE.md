# cache-cleanup: Visual Deep Dive

Concentrated diagrams for [.github/workflows/cache-cleanup.yml](../workflows/cache-cleanup.yml). Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

This workflow prunes GitHub Actions cache entries that belong to short-lived refs (closed PRs, published tags, ad-hoc branches) so cache storage stays under quota without evicting the hot caches on the default development branch.

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers and what each one cleans](#2-triggers-and-what-each-one-cleans)
- [3. Inputs](#3-inputs)
- [4. The one-job DAG with steps](#4-the-one-job-dag-with-steps)
- [5. Step-by-step lifecycle](#5-step-by-step-lifecycle)
- [6. The ref resolution logic](#6-the-ref-resolution-logic)
- [7. The cache deletion loop](#7-the-cache-deletion-loop)
- [8. External calls](#8-external-calls)
- [9. Output](#9-output)
- [10. Why development is excluded](#10-why-development-is-excluded)
- [11. Failure modes](#11-failure-modes)
- [12. Quick reference card](#12-quick-reference-card)

---

## 1. The whole picture

How [cache-cleanup.yml](../workflows/cache-cleanup.yml) sits between GitHub events and the Actions cache store.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef skip fill:#7c2d12,color:#fff,stroke:#000

    subgraph T["Triggers"]
        t1["pull_request closed\n(merged or abandoned)"]:::trig
        t2["release published\n(any tag)"]:::trig
        t3["workflow_dispatch\ninputs.branch optional"]:::trig
    end

    subgraph S["Secrets and Identity"]
        s1["APP_ID + APP_PRIVATE_KEY"]:::file
        bot["llm-exe-bot[bot]\nshort-lived token\n(needs actions: write)"]:::file
    end

    subgraph A["cache-cleanup.yml"]
        J["cleanup job\nubuntu-latest, single job"]:::job
    end

    subgraph R["Refs computed per event"]
        r1["PR_REF\nrefs/pull/&lt;N&gt;/merge"]:::file
        r2["BRANCH_REF\nhead.ref OR target_commitish OR input"]:::file
        r3["TAG_REF\nrefs/tags/&lt;tag&gt;"]:::file
    end

    subgraph X["External"]
        ghx["gh extension\nactions/gh-actions-cache"]:::ext
        api["GitHub Actions Cache API\n(list + delete by key)"]:::ext
    end

    subgraph O["Output side effects"]
        del["Cache entries deleted\nin the repo's cache store"]:::out
        log["Run log\ndeleted vs failed counters"]:::out
        keep["development branch caches\nleft untouched"]:::skip
    end

    t1 --> J
    t2 --> J
    t3 --> J
    s1 --> bot
    bot --> J
    J --> r1
    J --> r2
    J --> r3
    J --> ghx
    ghx --> api
    api --> del
    J --> log
    J -.-> keep
```

[Back to top](#navigate)

---

## 2. Triggers and what each one cleans

Three entry points. Each one resolves a different combination of refs to scrub.

```mermaid
flowchart TB
    classDef pr fill:#0e7490,color:#fff,stroke:#000
    classDef rel fill:#7c2d12,color:#fff,stroke:#000
    classDef man fill:#9333ea,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{github.event_name?}

    ev -->|pull_request| P1[types: closed]:::pr
    P1 --> P2["PR_REF = refs/pull/&lt;N&gt;/merge\nBRANCH_REF = head.ref\nTAG_REF = (empty)"]:::pr
    P2 --> P3["cleans: PR merge ref caches\nand the source branch caches\n(unless branch is development)"]:::out

    ev -->|release| R1[types: published]:::rel
    R1 --> R2["PR_REF = (empty)\nBRANCH_REF = target_commitish\nTAG_REF = refs/tags/&lt;tag&gt;"]:::rel
    R2 --> R3["cleans: tag ref caches\nand the release target branch caches\n(unless target is development)"]:::out

    ev -->|workflow_dispatch| M1["inputs.branch optional"]:::man
    M1 --> M2["PR_REF = (empty)\nBRANCH_REF = input OR github.ref_name\nTAG_REF = (empty)"]:::man
    M2 --> M3["cleans: that single branch's caches\n(unless branch is development)"]:::out
```

Source: [.github/workflows/cache-cleanup.yml](../workflows/cache-cleanup.yml) lines 3-15 (triggers) and lines 39-66 (ref resolution).

[Back to top](#navigate)

---

## 3. Inputs

Only one input, only on `workflow_dispatch`. Everything else is derived from event context.

```mermaid
flowchart LR
    classDef inp fill:#7c2d12,color:#fff,stroke:#000
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    subgraph Inputs
        I1["inputs.branch\n(string, optional, default '')\nworkflow_dispatch only"]:::inp
    end

    subgraph EventContext["Event context (auto)"]
        C1["github.event.pull_request.number\nfrom pull_request event"]:::src
        C2["github.event.pull_request.head.ref\nfrom pull_request event"]:::src
        C3["github.event.release.target_commitish\nfrom release event"]:::src
        C4["github.event.release.tag_name\nfrom release event"]:::src
        C5["github.ref_name\nthe ref this run was queued against"]:::src
    end

    subgraph Effects
        E1["sets BRANCH_REF when present\n(overrides github.ref_name)"]:::out
        E2["computes PR_REF + BRANCH_REF\nfor pull_request"]:::out
        E3["computes BRANCH_REF + TAG_REF\nfor release"]:::out
        E4["falls back to github.ref_name\nif dispatch input is empty"]:::out
    end

    I1 --> E1
    C1 --> E2
    C2 --> E2
    C3 --> E3
    C4 --> E3
    C5 --> E4
    I1 -.empty.-> E4
```

The one knob is escape-hatch only: a maintainer can dispatch the workflow and target any branch by name, which is useful for cleaning up after an abandoned feature branch that never went through a PR close.

[Back to top](#navigate)

---

## 4. The one-job DAG with steps

Single job, four steps, top-to-bottom.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef perm fill:#7c2d12,color:#fff,stroke:#000

    start([Workflow event])
    start --> P1["permissions block\nid-token: write\ncontents: write\nactions: write"]:::perm
    P1 --> J1

    subgraph J1["Job: cleanup (ubuntu-latest)"]
        direction TB
        s1["Step 1: Generate bot token\nactions/create-github-app-token@v3"]:::step
        s2["Step 2: Install gh extension\ngh extension install actions/gh-actions-cache"]:::step
        s3["Step 3: Resolve refs to clean\nbash, sets pr_ref, branch_ref, tag_ref outputs"]:::step
        s4["Step 4: Cleanup Caches\nlist + dedupe + delete loop"]:::step
        s1 --> s2 --> s3 --> s4
    end

    J1 --> done([end])
```

No matrix, no fan-out, no concurrency group. One run per event. Why `actions: write` is required: deleting cache entries via `gh actions-cache delete` writes to the Actions store. Without it, `gh` returns 403.

[Back to top](#navigate)

---

## 5. Step-by-step lifecycle

One run from event to last log line, with every ref and external call.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event
    participant J as cleanup job
    participant T as Token mint
    participant GHX as gh extension install
    participant RES as Resolve refs step
    participant CLR as Cleanup Caches step
    participant API as GitHub Actions Cache API

    E->>J: pull_request closed / release published / dispatch
    J->>T: create-github-app-token (APP_ID, APP_PRIVATE_KEY)
    T-->>J: short-lived bot token
    J->>GHX: gh extension install actions/gh-actions-cache
    GHX-->>J: extension ready on PATH
    J->>RES: bash resolves event_name branches
    Note over RES: writes pr_ref, branch_ref, tag_ref to GITHUB_OUTPUT
    RES-->>J: refs available as steps.refs.outputs
    J->>CLR: read three refs, init ALL_CACHE_OUTPUT empty

    alt PR_REF is non-empty
        CLR->>API: gh actions-cache list -B PR_REF -L 100
        API-->>CLR: tab-separated key rows
        CLR->>CLR: append to ALL_CACHE_OUTPUT
    end

    alt BRANCH_REF non-empty and not development
        CLR->>API: gh actions-cache list -B BRANCH_REF -L 100
        API-->>CLR: tab-separated key rows
        CLR->>CLR: append to ALL_CACHE_OUTPUT
    else BRANCH_REF equals development
        CLR->>CLR: log skip, do not list
    end

    alt TAG_REF is non-empty
        CLR->>API: gh actions-cache list -B TAG_REF -L 100
        API-->>CLR: tab-separated key rows
        CLR->>CLR: append to ALL_CACHE_OUTPUT
    end

    CLR->>CLR: awk extracts column 1, sort, uniq
    loop for each unique cacheKey
        CLR->>API: gh actions-cache delete cacheKey --confirm
        alt success
            API-->>CLR: 200 OK
            CLR->>CLR: DELETED++
        else failure
            API-->>CLR: error
            CLR->>CLR: FAILED++
        end
    end
    CLR-->>J: log "Deleted: X, Failed: Y"
```

Source: [.github/workflows/cache-cleanup.yml](../workflows/cache-cleanup.yml) lines 22-144.

[Back to top](#navigate)

---

## 6. The ref resolution logic

The Resolve refs step is a three-way branch on `github.event_name`. Each branch sets a different subset of `PR_REF`, `BRANCH_REF`, `TAG_REF`. Anything left unset stays empty and gets skipped downstream.

```mermaid
flowchart TB
    classDef init fill:#1e3a8a,color:#fff,stroke:#000
    classDef pr fill:#0e7490,color:#fff,stroke:#000
    classDef rel fill:#7c2d12,color:#fff,stroke:#000
    classDef man fill:#9333ea,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    A["Initialize\nPR_REF=''\nBRANCH_REF=''\nTAG_REF=''"]:::init
    A --> Q{github.event_name?}

    Q -->|pull_request| P1["PR_REF = refs/pull/&lt;number&gt;/merge"]:::pr
    P1 --> P2["BRANCH_REF = pull_request.head.ref"]:::pr
    P2 --> P3["TAG_REF stays empty"]:::pr

    Q -->|release| R1["BRANCH_REF = release.target_commitish"]:::rel
    R1 --> R2["TAG_REF = refs/tags/&lt;tag_name&gt;"]:::rel
    R2 --> R3["PR_REF stays empty"]:::rel

    Q -->|workflow_dispatch| M1{inputs.branch non-empty?}:::man
    M1 -->|yes| M2["BRANCH_REF = inputs.branch"]:::man
    M1 -->|no| M3["BRANCH_REF = github.ref_name"]:::man
    M2 --> M4["PR_REF and TAG_REF stay empty"]:::man
    M3 --> M4

    P3 --> W["Write three values to GITHUB_OUTPUT\npr_ref, branch_ref, tag_ref"]:::out
    R3 --> W
    M4 --> W
```

The next step reads back those outputs from `steps.refs.outputs.*`. An empty string short-circuits the corresponding list call.

[Back to top](#navigate)

---

## 7. The cache deletion loop

Listing is per ref. Deletion is global across all collected keys, after dedupe.

```mermaid
flowchart TB
    classDef step fill:#1e3a8a,color:#fff,stroke:#000
    classDef cond fill:#7c2d12,color:#fff,stroke:#000
    classDef accum fill:#155e75,color:#fff,stroke:#000
    classDef loop fill:#581c87,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    A["Read three refs from\nsteps.refs.outputs"]:::step
    A --> B["ALL_CACHE_OUTPUT = ''"]:::accum

    B --> C1{PR_REF non-empty?}:::cond
    C1 -->|yes| L1["gh actions-cache list\n-B PR_REF -L 100"]:::step
    L1 --> A1["append output to\nALL_CACHE_OUTPUT"]:::accum
    C1 -->|no| C2
    A1 --> C2

    C2{BRANCH_REF non-empty\nAND != development?}:::cond
    C2 -->|yes| L2["gh actions-cache list\n-B BRANCH_REF -L 100"]:::step
    L2 --> A2["append output"]:::accum
    C2 -->|no| C3
    A2 --> C3

    C3{TAG_REF non-empty?}:::cond
    C3 -->|yes| L3["gh actions-cache list\n-B TAG_REF -L 100"]:::step
    L3 --> A3["append output"]:::accum
    C3 -->|no| P
    A3 --> P

    P["Parse: awk -F'\\t'\nkeep column 1 where row != KEY header and != empty\nthen sort | uniq"]:::step
    P --> E{cacheKeys empty?}:::cond
    E -->|yes| Z1["log 'No cache keys found'"]:::out
    E -->|no| K["DELETED=0, FAILED=0"]:::loop

    K --> LP["while read cacheKey"]:::loop
    LP --> D["gh actions-cache delete\ncacheKey --confirm"]:::step
    D --> R{exit 0?}:::cond
    R -->|yes| INC["DELETED++"]:::accum
    R -->|no| INF["FAILED++"]:::accum
    INC --> LP
    INF --> LP
    LP -->|done| Z2["log 'Deleted: X, Failed: Y'"]:::out
```

Why dedupe with `sort | uniq`: when a PR head ref overlaps with the merge ref (or the branch is also the release target), the same key can appear twice in `ALL_CACHE_OUTPUT`. `gh actions-cache delete` on a key that no longer exists counts as a failure, so dedup keeps the FAILED counter clean.

Why `-L 100`: that is the page size, not the total. Caches beyond 100 per ref on a single sweep will not be picked up until the next event for the same ref. The PR-close path is event-driven and rare per ref, so 100 is enough in practice.

[Back to top](#navigate)

---

## 8. External calls

Four outbound interactions. All authenticated with the bot token.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef tool fill:#581c87,color:#fff,stroke:#000
    classDef api fill:#1f2937,color:#fff,stroke:#000

    subgraph Setup["Before listing"]
        s1["actions/create-github-app-token@v3\nauth: APP_ID + APP_PRIVATE_KEY\nwhy: short-lived token with actions: write"]:::pre
        s2["gh extension install\nactions/gh-actions-cache\nauth: bot token\nwhy: add list/delete subcommands"]:::pre
    end

    subgraph Runtime["During the cleanup"]
        d1["gh actions-cache list -R -B -L 100\nauth: GH_TOKEN bot token\nwhy: enumerate cache keys for a ref"]:::tool
        d2["gh actions-cache delete &lt;key&gt; -R --confirm\nauth: GH_TOKEN bot token\nwhy: remove one cache entry"]:::tool
    end

    subgraph Backend["GitHub side"]
        b1["api.github.com\n/repos/{owner}/{repo}/actions/caches\n(list endpoint)"]:::api
        b2["api.github.com\n/repos/{owner}/{repo}/actions/caches\n(delete by key + ref)"]:::api
    end

    s1 --> s2
    s2 --> d1
    d1 --> b1
    d1 --> d2
    d2 --> b2
```

The action token (`GITHUB_TOKEN`) is overridden by the bot token via env on both setup and cleanup steps. Both `GH_TOKEN` (used by `gh`) and `GITHUB_TOKEN` (used by some extensions internally) point at the same minted token to avoid auth ambiguity.

[Back to top](#navigate)

---

## 9. Output

This workflow produces no files, no PRs, no issues, no artifacts. Side effects are entirely on the GitHub Actions cache store, plus log output.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef none fill:#374151,color:#fff,stroke:#000

    AR["cache-cleanup.yml\nrun completes"]:::src

    AR --> O1["Cache entries removed\nfrom repo cache store"]:::out
    AR --> O2["Run log lines\n'Found N caches for X'\n'Deleted N, Failed M'"]:::out
    AR --> O3["GitHub Actions run summary\n(visible in Actions tab)"]:::out

    AR -.does not produce.-> N1["no commits"]:::none
    AR -.does not produce.-> N2["no PRs"]:::none
    AR -.does not produce.-> N3["no issues"]:::none
    AR -.does not produce.-> N4["no artifacts"]:::none
    AR -.does not produce.-> N5["no downstream workflow triggers"]:::none
```

The only observable signal that the workflow ran is the per-ref `Found N caches` and the final `Deleted X, Failed Y` lines in the run log. No notification, no comment, no badge.

[Back to top](#navigate)

---

## 10. Why development is excluded

`development` is the default branch. It is also the base for every agent PR and the source of the hot cache for `npm ci` across the whole repo. Dropping that cache forces every subsequent CI run to do a cold `npm ci`, which is the single most expensive step in the test workflow.

```mermaid
flowchart TB
    classDef hot fill:#7c2d12,color:#fff,stroke:#000
    classDef cold fill:#1e3a8a,color:#fff,stroke:#000
    classDef bad fill:#581c87,color:#fff,stroke:#000
    classDef good fill:#064e3b,color:#fff,stroke:#000

    subgraph Without["If development were NOT excluded"]
        W1["PR closes against development"]:::cold
        W1 --> W2["cleanup lists development caches"]:::cold
        W2 --> W3["deletes node_modules cache for development"]:::bad
        W3 --> W4["next tests.yml run on development\nor any PR rebased on it"]:::bad
        W4 --> W5["cold npm ci on Node 18, 20, 22, 24\nfour matrix legs, multi-minute penalty per leg"]:::bad
    end

    subgraph With["With the explicit skip"]
        Y1["BRANCH_REF resolves to development"]:::cold
        Y1 --> Y2{branch == development?}
        Y2 -->|yes| Y3["log skip, do not list, do not delete"]:::good
        Y3 --> Y4["hot cache preserved"]:::good
        Y4 --> Y5["tests.yml on next PR stays warm\nnpm ci hits cache"]:::good
    end
```

The check is at line 91 and 100-102 of [.github/workflows/cache-cleanup.yml](../workflows/cache-cleanup.yml). It is a string compare, not a glob, so `development` is the only protected name. A future rename of the default branch would need this line updated.

PR-close events still clean the PR's own head branch caches, even if that head branch was `development` (which is structurally impossible since you cannot open a PR from development to itself in the normal flow). Tag refs and PR merge refs are never protected because their caches are inherently throwaway.

[Back to top](#navigate)

---

## 11. Failure modes

What can go wrong and what the workflow does about it.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["Bot token mint fails\nAPP_ID or APP_PRIVATE_KEY rotated"]:::fail
    F1 --> F1E["job fails at step 1\nno cache deletion happens"]:::effect
    F1E --> F1X["rotate app key, re-add secret"]:::fix

    F2["gh extension install fails\nnetwork or GitHub outage"]:::fail
    F2 --> F2E["job fails at step 2\nno list/delete possible"]:::effect
    F2E --> F2X["re-run workflow, transient"]:::fix

    F3["gh actions-cache list fails for one ref"]:::fail
    F3 --> F3E["error logged, other refs still tried\nALL_CACHE_OUTPUT just misses that ref's keys"]:::effect
    F3E --> F3X["caches age out naturally\nor next event for same ref retries"]:::fix

    F4["gh actions-cache delete fails for one key\n(already deleted, race with another job)"]:::fail
    F4 --> F4E["FAILED counter increments\nloop continues to next key"]:::effect
    F4E --> F4X["expected on duplicate keys post-dedupe edge cases\nor concurrent cleanup"]:::fix

    F5["Ref has more than 100 caches\n(busy long-lived branch)"]:::fail
    F5 --> F5E["only first 100 listed\nothers survive this run"]:::effect
    F5X["next close/release/dispatch for same ref\npicks up another 100, eventually drains"]:::fix
    F5E --> F5X

    F6["BRANCH_REF accidentally resolves to development\n(maintainer dispatch with branch=development)"]:::fail
    F6 --> F6E["skip branch fires, no deletion\nlogs 'Skipping cache cleanup for this branch'"]:::effect
    F6E --> F6X["intentional protection, not a bug"]:::fix

    F7["Workflow lacks actions: write permission\n(e.g. settings change)"]:::fail
    F7 --> F7E["every delete returns 403\nFAILED equals TOTAL"]:::effect
    F7E --> F7X["restore permissions block at top of file"]:::fix

    F8["github.event.pull_request.head.ref empty\n(weird fork edge case)"]:::fail
    F8 --> F8E["BRANCH_REF empty, branch list step skipped\nonly PR_REF caches cleaned"]:::effect
    F8E --> F8X["acceptable, PR merge ref is the bulk anyway"]:::fix

    F9["release.target_commitish is a commit SHA\nnot a branch name"]:::fail
    F9 --> F9E["gh actions-cache list -B &lt;sha&gt;\nlikely returns zero keys"]:::effect
    F9E --> F9X["tag ref still gets cleaned\nbranch caches stay until next event"]:::fix
```

Listing failures are non-fatal by design: the `if prCacheKeysOutput=...; then ... else ... fi` pattern logs and continues. Delete failures are also non-fatal: the loop carries on and reports counts at the end.

[Back to top](#navigate)

---

## 12. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/cache-cleanup.yml"]:::v
    K2["Triggers"]:::k --- V2["pull_request closed, release published, workflow_dispatch"]:::v
    K3["Inputs"]:::k --- V3["branch (string, optional, dispatch only)"]:::v
    K4["Permissions"]:::k --- V4["id-token: write, contents: write, actions: write"]:::v
    K5["Jobs"]:::k --- V5["1 (cleanup)"]:::v
    K6["Runner"]:::k --- V6["ubuntu-latest"]:::v
    K7["Identity"]:::k --- V7["llm-exe-bot[bot] via App token"]:::v
    K8["GH extension"]:::k --- V8["actions/gh-actions-cache"]:::v
    K9["List page size"]:::k --- V9["100 per ref"]:::v
    K10["Protected branch"]:::k --- V10["development (hardcoded skip)"]:::v
    K11["Refs cleaned (PR)"]:::k --- V11["refs/pull/N/merge + head.ref"]:::v
    K12["Refs cleaned (release)"]:::k --- V12["refs/tags/tag + target_commitish"]:::v
    K13["Refs cleaned (dispatch)"]:::k --- V13["inputs.branch OR github.ref_name"]:::v
    K14["Dedup strategy"]:::k --- V14["awk + sort | uniq"]:::v
    K15["Output"]:::k --- V15["log lines only (Deleted X, Failed Y)"]:::v
    K16["Downstream"]:::k --- V16["none"]:::v
```

Direct links:

- Workflow file: [.github/workflows/cache-cleanup.yml](../workflows/cache-cleanup.yml)
- gh extension docs: [actions/gh-actions-cache](https://github.com/actions/gh-actions-cache)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)

[Back to top](#navigate)
