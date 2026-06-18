# update-prs-with-development: Visual Deep Dive

Concentrated diagrams for [.github/workflows/update-prs-with-development.yml](../workflows/update-prs-with-development.yml). Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

This workflow is intentionally simple. One job, one loop, dispatch only. Its purpose is to keep open PRs from rotting against `development` by rebasing them on demand. Draft PRs are skipped.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers (dispatch only)](#2-triggers-dispatch-only)
- [3. The one-job DAG](#3-the-one-job-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. The PR update loop](#5-the-pr-update-loop)
- [6. Why bot token vs default token](#6-why-bot-token-vs-default-token)
- [7. Output cascade](#7-output-cascade)
- [8. Failure modes](#8-failure-modes)
- [9. Quick reference card](#9-quick-reference-card)

---

## 1. The whole picture

How [update-prs-with-development.yml](../workflows/update-prs-with-development.yml) fits in.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        d1["workflow_dispatch\n(no inputs)"]:::trig
    end

    subgraph W["update-prs-with-development.yml"]
        J["update-prs job\ntimeout 15m"]:::job
    end

    subgraph S["Secrets and Identity"]
        s1["APP_CLIENT_ID + APP_PRIVATE_KEY"]:::file
        bot["llm-exe-bot[bot]\nshort-lived token"]:::file
    end

    subgraph X["External"]
        gh["GitHub API\n(gh pr list, gh pr update-branch)"]:::ext
    end

    subgraph O["Outputs"]
        rebased["PR head branches\nrebased on development"]:::out
    end

    subgraph D["Downstream workflows"]
        tst["tests.yml\nfires on PR synchronize"]:::job
        rev["agent-review-pr.yml\nfires on agent/* synchronize"]:::job
    end

    d1 --> J
    s1 --> bot
    bot --> J
    J --> gh
    gh --> rebased
    rebased --> tst
    rebased --> rev
```

[Back to top](#navigate)

---

## 2. Triggers (dispatch only)

One entry point. No cron, no push trigger (both are commented out in the YAML). The workflow runs only on manual dispatch.

```mermaid
flowchart TB
    classDef manual fill:#9333ea,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|workflow_dispatch| disp[on-demand run\nany day, any time]:::manual
    ev -->|other| skip([no trigger registered])

    disp --> run[(start update-prs job)]:::out
```

The cron schedule (`0 8 * * 1-5`) was removed. The push trigger on development is commented out. The maintainer dispatches this workflow manually when they want PRs rebased.

Source: [.github/workflows/update-prs-with-development.yml](../workflows/update-prs-with-development.yml) lines 3-5.

[Back to top](#navigate)

---

## 3. The one-job DAG

There is one job. No gates. No matrix. No dependencies.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000

    start([Workflow event])
    start --> J

    subgraph J["Job: update-prs (ubuntu-latest, timeout-minutes: 15)"]
        direction TB
        s1["Generate bot token\nactions/create-github-app-token@v3"]:::step
        s2["Checkout\nactions/checkout@v6\nwith bot token"]:::step
        s3["Update open PRs targeting development\nbash script: list + loop + update-branch"]:::step
        s1 --> s2 --> s3
    end

    J --> done([end])
```

Permissions granted to this single job:

| Scope | Level | Why |
|-------|-------|-----|
| `contents` | write | `gh pr update-branch` rewrites the PR head branch |
| `pull-requests` | write | required by `gh pr update-branch` API |

Source: [.github/workflows/update-prs-with-development.yml](../workflows/update-prs-with-development.yml) lines 7-14.

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

One run from event to completion.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event
    participant J as update-prs job
    participant T as Token mint
    participant G as Git checkout
    participant GH as GitHub API
    participant PR as Open PRs

    E->>J: workflow_dispatch
    J->>T: create-github-app-token@v3 (APP_CLIENT_ID, APP_PRIVATE_KEY)
    T-->>J: bot token (short-lived)
    J->>G: actions/checkout@v6 with bot token
    G-->>J: working tree ready
    J->>GH: gh pr list --base development --state open --json number
    GH-->>J: PR numbers (one per line) or empty
    Note over J: if empty, log and exit 0
    loop for each PR number
        J->>GH: gh pr update-branch (N)
        alt success
            GH-->>PR: rebase PR head onto development tip
            GH-->>J: 0 exit
            J->>J: log "PR (N) updated successfully"
        else conflict or already current
            GH-->>J: non-zero exit
            J->>J: log "PR (N) skipped"
        end
    end
    J->>E: job completes (always green)
```

Source: [.github/workflows/update-prs-with-development.yml](../workflows/update-prs-with-development.yml) lines 18-49.

[Back to top](#navigate)

---

## 5. The PR update loop

The core logic is fifteen lines of bash. Here it is as a flowchart.

```mermaid
flowchart TB
    classDef step fill:#1e3a8a,color:#fff,stroke:#000
    classDef dec fill:#7c2d12,color:#fff,stroke:#000
    classDef ok fill:#064e3b,color:#fff,stroke:#000
    classDef skip fill:#374151,color:#fff,stroke:#000

    A["gh pr list --base development\n--state open --json number\n--jq '.[].number'"]:::step
    A --> B{PR_NUMBERS empty?}:::dec
    B -->|yes| E["echo 'No open PRs'\nexit 0"]:::skip
    B -->|no| C[loop: for PR in PR_NUMBERS]:::step
    C --> DRAFT{gh pr view N\nisDraft?}:::dec
    DRAFT -->|true| SKIP_D["echo 'PR #(N) is a draft - skipping'"]:::skip
    DRAFT -->|false| D["echo 'Attempting to update PR #(N)'"]:::step
    SKIP_D --> J
    D --> F["gh pr update-branch (N) 2&gt;&amp;1"]:::step
    F --> G{exit code?}:::dec
    G -->|0| H["echo 'PR #(N) updated successfully'"]:::ok
    G -->|non-zero| I["echo 'PR #(N) skipped\n(conflicts or already up to date)'"]:::skip
    H --> J{more PRs?}:::dec
    I --> J
    J -->|yes| C
    J -->|no| K([loop done, job green])
    E --> K
```

Two important properties:

1. **No early exit on failure.** A failed `update-branch` does not halt the loop. The `if` wrapper swallows the non-zero exit so the remaining PRs still get a shot. A single conflicting PR cannot block the sweep.
2. **No distinction between conflict and no-op.** "Already up to date" and "merge conflict" both produce non-zero exits and the same log line. The maintainer reads the logs only when something feels off; otherwise green is green.

Source: [.github/workflows/update-prs-with-development.yml](../workflows/update-prs-with-development.yml) lines 34-49.

[Back to top](#navigate)

---

## 6. Why bot token vs default token

This is the only design choice in the workflow worth defending.

```mermaid
flowchart LR
    classDef bad fill:#7c2d12,color:#fff,stroke:#000
    classDef good fill:#064e3b,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000

    subgraph DEFAULT["If we used GITHUB_TOKEN"]
        d1["gh pr update-branch (N)\nauthored by github-actions[bot]"]:::step
        d2["PR head branch updates"]:::step
        d3["push event suppressed\n(prevents recursive workflow loops)"]:::bad
        d4["tests.yml does NOT fire\nagent-review-pr.yml does NOT fire"]:::bad
        d1 --> d2 --> d3 --> d4
    end

    subgraph BOT["What we actually do (App token)"]
        b1["gh pr update-branch (N)\nauthored by llm-exe-bot[bot]"]:::step
        b2["PR head branch updates"]:::step
        b3["push event fires normally\n(App token is not GITHUB_TOKEN)"]:::good
        b4["tests.yml fires (PR synchronize)\nagent-review-pr.yml fires for agent/*"]:::good
        b1 --> b2 --> b3 --> b4
    end
```

GitHub deliberately suppresses workflow triggers when actions are taken with the built-in `GITHUB_TOKEN`. This prevents infinite loops where workflow A pushes, which fires workflow B, which pushes, and so on. The trade-off is that legitimate cross-workflow chains break too. Using a GitHub App token sidesteps the suppression: the token is owned by an identity (`llm-exe-bot[bot]`) that GitHub treats as a real user. Push events fire, CI runs on the rebased commits, and stale-looking checks get refreshed.

This is the entire reason the workflow mints an App token instead of using the ambient `GITHUB_TOKEN`. The bot identity is not cosmetic; it is mechanically required for the downstream cascade.

Source: [.github/workflows/update-prs-with-development.yml](../workflows/update-prs-with-development.yml) lines 19-24, 33.

[Back to top](#navigate)

---

## 7. Output cascade

What rebasing produces and who eats it.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    U["update-prs-with-development.yml\nweekday 3am CT"]:::src

    U --> O1["PR (N) head branch rewritten\non top of development tip"]:::out
    U --> O2["push event fires\n(bot token, not GITHUB_TOKEN)"]:::out

    O2 --> C1["tests.yml\nPR synchronize\nNode 18, 20, 22, 24 matrix"]:::cons
    O2 --> C2["agent-review-pr.yml\nfires for branches startsWith 'agent/'"]:::cons

    O1 --> C3["maintainer opens PR\nsees clean status, no conflict markers"]:::human

    C1 --> C3
    C2 --> C3

    C3 --> M["faster merges to development"]:::human
```

The cascade is what makes this workflow valuable. Without it, the maintainer arrives in the morning to find PRs marked "out-of-date with base" and has to manually click "Update branch" on each. With it, the work is done and CI has already revalidated the result. The maintainer sees a green PR ready to merge.

[Back to top](#navigate)

---

## 8. Failure modes

Where things can break and what happens.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["No open PRs targeting development"]:::fail
    F1 --> F1E["script logs 'No open PRs', exits 0"]:::effect
    F1E --> F1X["expected, not a failure"]:::fix

    F2["PR has merge conflicts\nagainst development"]:::fail
    F2 --> F2E["gh pr update-branch exits non-zero\nlogged as 'skipped'\nloop continues"]:::effect
    F2X["PR author resolves conflicts manually\nor maintainer closes stale PR"]:::fix
    F2E --> F2X

    F3["PR already up to date\n(rare but possible)"]:::fail
    F3 --> F3E["gh pr update-branch exits non-zero\nsame 'skipped' log line"]:::effect
    F3X["benign, no action needed"]:::fix
    F3E --> F3X

    F4["Bot token mint fails\n(APP_CLIENT_ID or APP_PRIVATE_KEY wrong)"]:::fail
    F4 --> F4E["job fails at first step\nno PRs updated this morning"]:::effect
    F4X["rotate App key, re-add secret\nnext cron picks up"]:::fix
    F4E --> F4X

    F5["Job exceeds 15-minute timeout\n(many PRs or slow API)"]:::fail
    F5 --> F5E["runner kills the job\nPRs after the cutoff are not touched"]:::effect
    F5X["increase timeout if recurring\nor accept partial sweep\n(next day catches the rest)"]:::fix
    F5E --> F5X

    F6["GitHub API rate limit hit"]:::fail
    F6 --> F6E["gh pr update-branch fails\nlogged as 'skipped'\nloop continues to next PR"]:::effect
    F6X["App tokens have generous limits\nmanual dispatch later if needed"]:::fix
    F6E --> F6X
```

The script is deliberately tolerant. The only failure that produces a red job is a token mint failure or a timeout. Per-PR failures are absorbed by design, which means a red workflow in this file is always a real infrastructure problem, never a stale PR.

[Back to top](#navigate)

---

## 9. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/update-prs-with-development.yml"]:::v
    K2["Triggers"]:::k --- V2["workflow_dispatch only (cron commented out)"]:::v
    K3["Inputs"]:::k --- V3["none"]:::v
    K4["Permissions"]:::k --- V4["contents: write, pull-requests: write"]:::v
    K5["Timeout"]:::k --- V5["15 minutes"]:::v
    K6["Concurrency"]:::k --- V6["none (default group, no overlap risk)"]:::v
    K7["Identity"]:::k --- V7["llm-exe-bot[bot] via App token"]:::v
    K8["Base branch"]:::k --- V8["development"]:::v
    K9["Filter"]:::k --- V9["--state open --base development"]:::v
    K10["Per-PR action"]:::k --- V10["gh pr update-branch (N)"]:::v
    K11["Failure handling"]:::k --- V11["per-PR errors swallowed, loop continues"]:::v
    K12["Downstream fired"]:::k --- V12["tests.yml + agent-review-pr.yml"]:::v
    K13["Schedule (local)"]:::k --- V13["dispatch only (no cron schedule)"]:::v
```

Direct links:

- Workflow file: [.github/workflows/update-prs-with-development.yml](../workflows/update-prs-with-development.yml)
- Downstream consumers: [tests.yml](../workflows/tests.yml), [agent-review-pr.yml](../workflows/agent-review-pr.yml)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)
- Sibling deep dive: [AGENT_RUN_DEEP_DIVE.md](AGENT_RUN_DEEP_DIVE.md)

[Back to top](#navigate)
