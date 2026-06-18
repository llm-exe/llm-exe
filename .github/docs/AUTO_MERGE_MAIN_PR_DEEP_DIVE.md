# auto-merge-main-pr: Visual Deep Dive

Concentrated diagrams for [.github/workflows/auto-merge-main-pr.yml](../workflows/auto-merge-main-pr.yml) and the sibling workflows it depends on. Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers and what each one does](#2-triggers-and-what-each-one-does)
- [3. Run condition decision tree](#3-run-condition-decision-tree)
- [4. The one-job DAG](#4-the-one-job-dag)
- [5. Step-by-step lifecycle](#5-step-by-step-lifecycle)
- [6. The check-polling loop](#6-the-check-polling-loop)
- [7. The check evaluation](#7-the-check-evaluation)
- [8. External calls](#8-external-calls)
- [9. Output cascade](#9-output-cascade)
- [10. Why --admin](#10-why---admin)
- [11. The state machine](#11-the-state-machine)
- [12. Failure modes](#12-failure-modes)
- [13. Quick reference card](#13-quick-reference-card)

---

## 1. The whole picture

How [auto-merge-main-pr.yml](../workflows/auto-merge-main-pr.yml) plugs into the release rails.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph Up["Upstream"]
        U1["draft-main-pr.yml\nopens or refreshes dev to main PR"]:::job
        U2["check-semantic-versioning.yml\nworkflow_run source\nname: Release / Check Semver"]:::gate
    end

    subgraph T["Triggers on auto-merge-main-pr.yml"]
        t1["workflow_run\nworkflows: Release / Check Semver\ntypes: completed"]:::trig
        t2["pull_request\ntypes: ready_for_review, synchronize\nbranches: main"]:::trig
    end

    subgraph A["auto-merge-main-pr.yml"]
        cond{{"if: workflow_run.conclusion == success\n&& head_branch == development\nOR event_name == pull_request"}}:::gate
        J["job: auto-merge\nubuntu-latest"]:::job
        cond --> J
    end

    subgraph S["Secrets and Identity"]
        s1["APP_CLIENT_ID + APP_PRIVATE_KEY"]:::file
        bot["llm-exe-bot[bot]\nshort-lived token\nadmin on repo"]:::file
        s1 --> bot
    end

    subgraph X["External"]
        gh["GitHub API\n(gh pr list, gh pr checks, gh pr merge)"]:::ext
    end

    subgraph O["Outputs"]
        merged["development merged into main\n(merge commit, no squash)"]:::out
    end

    subgraph D["Downstream workflows on PR closed merged"]
        d1["create-draft-release.yml\npull_request closed on main"]:::job
        d2["draft-main-pr.yml\n(release published path)"]:::job
        d3["cache-cleanup.yml\npull_request closed"]:::job
    end

    U1 --> t2
    U2 --> t1
    t1 --> cond
    t2 --> cond
    bot --> J
    J --> gh
    gh --> merged
    merged --> d1
    merged --> d2
    merged --> d3
```

Source: [.github/workflows/auto-merge-main-pr.yml](../workflows/auto-merge-main-pr.yml) lines 3 to 30.

[Back to top](#navigate)

---

## 2. Triggers and what each one does

Two entry points, two routing paths, both converge on the same job.

```mermaid
flowchart TB
    classDef wr fill:#0e7490,color:#fff,stroke:#000
    classDef pr fill:#9333ea,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|workflow_run| wrPath["fired by completion of\nRelease / Check Semver"]:::wr
    ev -->|pull_request| prPath["ready_for_review OR synchronize\non branches: main"]:::pr

    wrPath --> wrChk{conclusion == success\nAND head_branch == development?}:::gate
    wrChk -->|yes| go[(run job: auto-merge)]:::out
    wrChk -->|no| skip([job skipped silently])

    prPath --> prChk{event_name == pull_request?\n(always true on this path)}:::gate
    prChk -->|yes| go
```

Why two triggers exist:

| Trigger | What it catches |
|---------|-----------------|
| `workflow_run` on Release / Check Semver | The semver gate just passed on a `development` to `main` PR. Time to merge. |
| `pull_request` ready_for_review on `main` | A draft dev to main PR flipped to ready. Or new commits arrived on `development`. Re-evaluate. |

The `workflow_run` trigger needs the secondary `head_branch == 'development'` guard because the semver workflow itself fires on any PR targeting `main`, but auto-merge should only fire for the dev to main PR.

[Back to top](#navigate)

---

## 3. Run condition decision tree

The job-level `if` expression on line 30 is the single gate. Both event types pass through it.

```mermaid
flowchart TB
    classDef ev fill:#0b3954,color:#fff,stroke:#000
    classDef yes fill:#064e3b,color:#fff,stroke:#000
    classDef no fill:#7c2d12,color:#fff,stroke:#000

    in([event delivered])
    in --> q1{github.event_name?}

    q1 -->|pull_request| pass1[("run job\n(pull_request path bypasses\nsemver checks)")]:::yes
    q1 -->|workflow_run| q2{workflow_run.conclusion?}

    q2 -->|success| q3{workflow_run.head_branch?}
    q2 -->|failure| skipA([skip]):::no
    q2 -->|cancelled| skipB([skip]):::no
    q2 -->|timed_out| skipC([skip]):::no

    q3 -->|development| pass2[("run job\n(semver passed for\ndev to main PR)")]:::yes
    q3 -->|anything else| skipD([skip - some other PR to main]):::no
```

Raw expression for reference:

```
github.event.workflow_run.conclusion == 'success'
  && github.event.workflow_run.head_branch == 'development'
  || github.event_name == 'pull_request'
```

Operator precedence: `&&` binds tighter than `||`, so this reads as `(A && B) || C`. A `pull_request` event always satisfies `C` and runs the job regardless of any workflow_run context.

[Back to top](#navigate)

---

## 4. The one-job DAG

Single job, six steps, sequential.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef cond fill:#7c2d12,color:#fff,stroke:#000

    start([event passes if-gate])
    start --> J

    subgraph J["Job: auto-merge (ubuntu-latest)"]
        direction TB
        s1["1. Checkout repository\nactions/checkout@v6"]:::step
        s2["2. Generate bot token\ncreate-github-app-token@v3"]:::step
        s3["3. Get PR number\ngh pr list, filter isDraft=false"]:::step
        c1{PR_NUMBER non-empty?}:::cond
        s4["4. Wait for checks\nloop max 10 x 30s"]:::step
        s5["5. Check PR check states\ncount FAILURE, exit if any"]:::step
        s6["6. Merge PR to main\ngh pr merge --merge --admin"]:::step

        s1 --> s2 --> s3 --> c1
        c1 -->|yes| s4 --> s5 --> s6
        c1 -->|no| skip([no eligible PR, steps 4-6 skipped])
    end
```

Concurrency group is `${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`. A new `synchronize` event on the same ref cancels the in-flight run.

Permissions granted at workflow scope:

| Permission | Why |
|------------|-----|
| `id-token: write` | OIDC for the bot token mint |
| `checks: write` | Write status back if needed |
| `contents: write` | Merge the PR (writes to `main`) |
| `pull-requests: write` | `gh pr merge` API |
| `actions: write` | Cancel sibling runs via concurrency |

[Back to top](#navigate)

---

## 5. Step-by-step lifecycle

One run from event to merge, sequence view.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event
    participant J as auto-merge job
    participant T as Token mint
    participant GH as GitHub API
    participant CK as PR checks
    participant M as main branch

    E->>J: workflow_run completed OR pull_request event
    J->>J: evaluate if-gate (line 30)
    J->>T: create-github-app-token (APP_CLIENT_ID, APP_PRIVATE_KEY)
    T-->>J: bot token (short-lived, admin)
    J->>GH: gh pr list base=main head=development state=open
    GH-->>J: PR number (filtered isDraft=false)
    Note over J: if PR_NUMBER empty, skip remaining steps
    loop max 10 iterations
        J->>CK: gh pr checks PR_NUMBER (exclude auto-merge)
        CK-->>J: count of IN_PROGRESS
        alt count == 0
            Note over J: break loop
        else count over 0
            J->>J: sleep 30 seconds
        end
    end
    J->>CK: gh pr checks PR_NUMBER (final read)
    CK-->>J: counts by state
    alt FAILURE count over 0
        J-->>E: exit 1, job fails
    else FAILURE count == 0
        J->>GH: gh pr merge PR_NUMBER merge admin
        GH->>M: create merge commit
        M-->>J: merged
    end
```

Source: [.github/workflows/auto-merge-main-pr.yml](../workflows/auto-merge-main-pr.yml) lines 32 to 100.

[Back to top](#navigate)

---

## 6. The check-polling loop

Five-minute ceiling on waiting for sibling checks.

```mermaid
flowchart TB
    classDef state fill:#1e3a8a,color:#fff,stroke:#000
    classDef cond fill:#7c2d12,color:#fff,stroke:#000
    classDef done fill:#064e3b,color:#fff,stroke:#000

    init["ATTEMPT = 0\nMAX_ATTEMPTS = 10"]:::state
    init --> guard

    guard{ATTEMPT &lt; 10?}:::cond
    guard -->|no| timeout["loop exits\n(checks may still be IN_PROGRESS)"]:::done
    guard -->|yes| poll

    poll["gh pr checks PR_NUMBER\nfilter: name != auto-merge AND state == IN_PROGRESS\nreturn array length"]:::state
    poll --> chk

    chk{CHECKS_IN_PROGRESS == 0?}:::cond
    chk -->|yes| ok["echo 'All checks are complete'\nbreak"]:::done
    chk -->|no| inc

    inc["echo waiting attempt N/10\nATTEMPT++\nsleep 30"]:::state
    inc --> guard

    timeout --> next["step 5 runs regardless\n(no failure on timeout)"]:::done
    ok --> next
```

Time math:

| Attempts | Wall clock |
|----------|------------|
| 1 success (no sleep) | ~5s (one API call) |
| 10 attempts, all over zero | 10 polls + 10 sleeps of 30s = 5 minutes |
| Worst case | ~5 minutes 5 seconds then step 5 fires |

Critical: the filter `name != "auto-merge"` is what prevents infinite loop. Without it, the workflow polls its own in-progress run forever (until the 6-hour GitHub Actions ceiling).

The loop does NOT fail if it times out. It just exits and lets step 5 evaluate whatever state the checks are in. Step 5 will likely see no FAILURE (long-running checks are still IN_PROGRESS, not FAILURE), so the merge proceeds. This is a known soft spot, see Failure modes.

[Back to top](#navigate)

---

## 7. The check evaluation

After the polling loop, evaluate the final state. Three counts, one gate.

```mermaid
flowchart TB
    classDef read fill:#0e7490,color:#fff,stroke:#000
    classDef cond fill:#7c2d12,color:#fff,stroke:#000
    classDef pass fill:#064e3b,color:#fff,stroke:#000
    classDef fail fill:#9a1d1d,color:#fff,stroke:#000

    A["gh pr checks PR_NUMBER --json name,state"]:::read
    A --> B["count FAILURE\n(name != auto-merge)"]:::read
    A --> C["count SUCCESS\n(name != auto-merge)"]:::read
    A --> D["count TOTAL\n(name != auto-merge)"]:::read

    B --> E{FAILURE &gt; 0?}:::cond
    E -->|yes| F["echo 'Some checks failed'\nexit 1"]:::fail
    E -->|no| G["echo 'Checks passed'\nstep succeeds"]:::pass

    F --> H[("job fails\nno merge attempted")]:::fail
    G --> I[("proceed to merge step")]:::pass
```

What this catches and what it misses:

| State | Counted as FAILURE? | Blocks merge? |
|-------|--------------------|----|
| `SUCCESS` | no | no |
| `FAILURE` | yes | yes, exit 1 |
| `IN_PROGRESS` (timed out from loop) | no | no, merge proceeds |
| `CANCELLED` | no | no |
| `SKIPPED` | no | no |
| `PENDING` | no | no |
| `NEUTRAL` | no | no |

The check is strictly negative: "are any checks definitively failing?" not "did everything pass?". A required check that never reported still lets the merge through. Branch protection on `main` is the second line of defense, but the bot bypasses it via `--admin` (see section 10).

[Back to top](#navigate)

---

## 8. External calls

Every network call this workflow makes, with credential and purpose.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef gh fill:#1f2937,color:#fff,stroke:#000
    classDef act fill:#581c87,color:#fff,stroke:#000

    subgraph Pre["Setup"]
        c1["actions/checkout@v6\nauth: GITHUB_TOKEN\nwhy: needed for context, not for diffs"]:::pre
        c2["actions/create-github-app-token@v3\nauth: APP_CLIENT_ID + APP_PRIVATE_KEY\nwhy: mint admin-capable bot token"]:::pre
    end

    subgraph During["gh CLI calls"]
        d1["gh pr list\nbase=main head=development state=open\njson=number,isDraft\nwhy: find the eligible PR"]:::gh
        d2["gh pr checks (in loop)\njson=name,state\nwhy: poll IN_PROGRESS count"]:::gh
        d3["gh pr checks (final)\njson=name,state\nwhy: tally FAILURE / SUCCESS / TOTAL"]:::gh
        d4["gh pr merge\nflags: --merge --admin --repo {owner}/{repo}\nwhy: execute merge, bypass protection"]:::gh
    end

    c1 --> c2
    c2 --> d1
    d1 --> d2
    d2 --> d3
    d3 --> d4
```

All `gh` calls use the bot token via `GH_TOKEN` and `GITHUB_TOKEN` env vars. The bot is granted admin via the GitHub App installation, which is what makes `--admin` viable.

[Back to top](#navigate)

---

## 9. Output cascade

What merging produces, and who eats it.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    AM["auto-merge-main-pr.yml\ngh pr merge --merge --admin"]:::src
    AM --> M["merge commit on main\nPR closed as merged"]:::out

    M --> C1["create-draft-release.yml\non: pull_request closed targeting main\nbuilds a draft GitHub Release\nfrom package.json version"]:::cons
    M --> C2["draft-main-pr.yml\nfires later on release: published\n(opens next dev to main PR)"]:::cons
    M --> C3["cache-cleanup.yml\non: pull_request closed\ndeletes branch-scoped action caches"]:::cons

    C1 --> H1["maintainer publishes draft release\n(human gate before npm publish)"]:::human
    H1 --> P1["publish-release.yml\non: release published\npublishes to npm"]:::cons
    H1 --> C2
```

Why the merge cascade is split across multiple workflows: each downstream listens on a different event (`pull_request closed`, `release published`), and decoupling lets a maintainer interrupt the chain at the release step. The human still ships, the bot just gets the bits there.

[Back to top](#navigate)

---

## 10. Why --admin

Branch protection on `main` requires reviews and passing checks. The bot bypasses both. Here is why that is acceptable.

```mermaid
flowchart TB
    classDef rule fill:#7c2d12,color:#fff,stroke:#000
    classDef bypass fill:#0e7490,color:#fff,stroke:#000
    classDef safe fill:#064e3b,color:#fff,stroke:#000

    BP["Branch protection on main\n- require reviews\n- require status checks\n- restrict who can push"]:::rule

    BP --> A["Without --admin:\ngh pr merge blocks with\n'Pull request is not mergeable'"]:::rule

    A --> B["With --admin flag:\nbypass enforcement"]:::bypass

    B --> C{Who has admin?}:::bypass
    C --> D["GitHub App installation\nllm-exe-bot[bot]\ngranted admin on repo"]:::bypass

    D --> E["Two-layer safety net:"]:::safe
    E --> F["Layer 1: workflow gates\n- workflow_run requires semver success\n- step 5 fails on any FAILURE check"]:::safe
    E --> G["Layer 2: who can trigger\n- workflow_run is internal\n- pull_request to main only fires\n  if someone opens a PR there"]:::safe
```

The risk shape:

- Risk of bypassing reviews: low. A human still opens the dev to main PR (or the bot opens a draft for human review). The auto-merge only happens after explicit `ready_for_review`.
- Risk of bypassing checks: medium. Step 5 only catches `FAILURE`, not stuck `IN_PROGRESS` checks. See Failure modes.

[Back to top](#navigate)

---

## 11. The state machine

A single run as a finite state machine.

```mermaid
stateDiagram-v2
    [*] --> EventReceived: workflow_run OR pull_request
    EventReceived --> GateEval: evaluate if-condition
    GateEval --> Skipped: condition false
    GateEval --> Booting: condition true
    Booting --> Setup: checkout + token mint
    Setup --> Lookup: gh pr list
    Lookup --> NoPR: PR_NUMBER empty
    Lookup --> Polling: PR_NUMBER set
    Polling --> Polling: IN_PROGRESS count over zero, sleep 30
    Polling --> Evaluating: IN_PROGRESS == 0 OR attempts exhausted
    Evaluating --> CheckFailed: FAILURE count over zero
    Evaluating --> Merging: FAILURE count == 0
    Merging --> Merged: gh pr merge admin returned 0
    Merging --> MergeError: gh pr merge admin returned non-zero
    NoPR --> [*]
    Skipped --> [*]
    CheckFailed --> [*]: exit 1
    Merged --> [*]
    MergeError --> [*]: exit non-zero
```

Note that `Polling` to `Evaluating` happens either way (success or attempt exhaustion). The polling step does not fail on timeout, it just yields control. `Evaluating` is the single gate.

[Back to top](#navigate)

---

## 12. Failure modes

Where things break, what happens, what to do.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["No eligible PR\n(gh pr list returns empty,\nonly drafts exist)"]:::fail
    F1 --> F1E["PR_NUMBER is empty string\nsteps 4, 5, 6 skipped via if env.PR_NUMBER != ''\njob succeeds with no-op"]:::effect
    F1E --> F1X["expected when dev is up to date\nor PR is still draft"]:::fix

    F2["A required check reports FAILURE"]:::fail
    F2 --> F2E["step 5 sees FAILURE count over 0\nexit 1, job fails\nno merge attempted"]:::effect
    F2X["fix the failing check on development\npush, re-trigger via synchronize"]:::fix
    F2E --> F2X

    F3["Polling timeout: checks still IN_PROGRESS\nafter 10 x 30s = 5 minutes"]:::fail
    F3 --> F3E["loop exits without break\nstep 5 evaluates current state\nIN_PROGRESS is not FAILURE\nmerge proceeds prematurely"]:::effect
    F3X["bump MAX_ATTEMPTS or sleep duration\nfor long-running CI matrices\nor add IN_PROGRESS check to step 5"]:::fix
    F3E --> F3X

    F4["Bot token mint fails\n(APP_CLIENT_ID or APP_PRIVATE_KEY wrong)"]:::fail
    F4 --> F4E["step 2 fails, subsequent steps skipped\nworkflow fails loud"]:::effect
    F4X["rotate App key, re-add secret"]:::fix
    F4E --> F4X

    F5["gh pr merge admin rejected\n(merge conflicts, e.g.)"]:::fail
    F5 --> F5E["step 6 exits non-zero\njob fails, no retry"]:::effect
    F5X["maintainer resolves conflict on development\npush to retrigger via synchronize"]:::fix
    F5E --> F5X

    F6["workflow_run fires but head_branch is not development\n(semver passed on some other PR to main)"]:::fail
    F6 --> F6E["if-condition false\njob skipped, no API calls"]:::effect
    F6X["working as intended"]:::fix
    F6E --> F6X

    F7["Two synchronize events in quick succession"]:::fail
    F7 --> F7E["concurrency cancel-in-progress: true\nfirst run cancelled, second proceeds"]:::effect
    F7X["working as intended\nlatest state wins"]:::fix
    F7E --> F7X

    F8["Required check never reported\n(skipped by branch filter, etc.)"]:::fail
    F8 --> F8E["step 5 sees no FAILURE\nstep 6 calls gh pr merge admin\nbypasses branch protection\nmerge proceeds"]:::effect
    F8X["audit required checks list\nadd explicit allowlist in step 5"]:::fix
    F8E --> F8X
```

[Back to top](#navigate)

---

## 13. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/auto-merge-main-pr.yml"]:::v
    K2["Triggers"]:::k --- V2["workflow_run (Release / Check Semver) + pull_request (main: ready_for_review, synchronize)"]:::v
    K3["Run condition"]:::k --- V3["wr.success && wr.head_branch=development OR event=pull_request"]:::v
    K4["Permissions"]:::k --- V4["id-token, checks, contents, pull-requests, actions: all write"]:::v
    K5["Concurrency"]:::k --- V5["workflow-ref scoped, cancel-in-progress: true"]:::v
    K6["Job"]:::k --- V6["auto-merge on ubuntu-latest, 6 steps"]:::v
    K7["Identity"]:::k --- V7["llm-exe-bot[bot] via App token (admin)"]:::v
    K8["PR lookup"]:::k --- V8["gh pr list base=main head=development state=open, drop drafts"]:::v
    K9["Wait loop"]:::k --- V9["10 attempts x 30s sleep = 5 min ceiling"]:::v
    K10["Self-exclusion"]:::k --- V10["name != 'auto-merge' filter avoids self-poll"]:::v
    K11["Merge style"]:::k --- V11["--merge (creates merge commit, not squash)"]:::v
    K12["Bypass"]:::k --- V12["--admin (overrides branch protection)"]:::v
    K13["Upstream gate"]:::k --- V13["check-semantic-versioning.yml must pass first"]:::v
    K14["Downstream effects"]:::k --- V14["create-draft-release.yml, draft-main-pr.yml, cache-cleanup.yml"]:::v
    K15["Failure exits"]:::k --- V15["step 5 exits 1 on any FAILURE check"]:::v
    K16["Silent skip"]:::k --- V16["empty PR_NUMBER skips steps 4-6 cleanly"]:::v
```

Direct links:

- Workflow file: [.github/workflows/auto-merge-main-pr.yml](../workflows/auto-merge-main-pr.yml)
- Upstream gate: [check-semantic-versioning.yml](../workflows/check-semantic-versioning.yml)
- PR opener: [draft-main-pr.yml](../workflows/draft-main-pr.yml)
- Downstream consumers: [create-draft-release.yml](../workflows/create-draft-release.yml), [cache-cleanup.yml](../workflows/cache-cleanup.yml), [publish-release.yml](../workflows/publish-release.yml)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)

[Back to top](#navigate)
