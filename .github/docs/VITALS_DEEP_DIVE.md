# vitals: Visual Deep Dive

Concentrated diagrams for [.github/workflows/vitals.yml](../workflows/vitals.yml) and the generator script at [.github/vitals/generate.sh](../vitals/generate.sh). Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md) and the template at [AGENT_RUN_DEEP_DIVE.md](AGENT_RUN_DEEP_DIVE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers](#2-triggers)
- [3. The one-job DAG](#3-the-one-job-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. Anatomy of AUTOMATION.md](#5-anatomy-of-automationmd)
- [6. Data sources](#6-data-sources)
- [7. Why the badges work](#7-why-the-badges-work)
- [8. Security boundaries](#8-security-boundaries)
- [9. Loop prevention](#9-loop-prevention)
- [10. External calls](#10-external-calls)
- [11. Output cascade](#11-output-cascade)
- [12. State machine](#12-state-machine)
- [13. Failure modes](#13-failure-modes)
- [14. Quick reference card](#14-quick-reference-card)

---

## 1. The whole picture

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef src fill:#374151,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        c["cron 0 8 * * *<br/>(daily 8am UTC)"]:::trig
        d["workflow_dispatch"]:::trig
    end

    subgraph V["vitals.yml"]
        R[refresh job]:::job
    end

    subgraph SRC["Inputs"]
        s1[".github/workflows/*.yml<br/>(list of workflows)"]:::src
        s2["scripts/agents/logs/*/<br/>(agent activity)"]:::src
        s3["gh API<br/>(PRs, issues, releases)"]:::src
    end

    subgraph X["External"]
        gh["api.github.com"]:::ext
        sh["img.shields.io<br/>(badges rendered client-side)"]:::ext
    end

    subgraph O["Output"]
        am["AUTOMATION.md<br/>at repo root"]:::out
    end

    c --> R
    d --> R
    R --> s1
    R --> s2
    R --> s3
    s3 --> gh
    R --> am
    am -. embedded shields URLs .-> sh
```

[Back to top](#navigate)

---

## 2. Triggers

```mermaid
flowchart TB
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef chk fill:#7c2d12,color:#fff,stroke:#000
    classDef ok fill:#064e3b,color:#fff,stroke:#000

    e([event])
    e --> q{event_name?}
    q -->|schedule (daily 8am UTC)| s[scheduled refresh]:::trig
    q -->|workflow_dispatch| d[manual dispatch]:::trig

    s --> a{actor != llm-exe-bot[bot]?}
    a -->|yes| go1[(proceed)]:::ok
    a -->|no| sk[(skip)]:::chk

    d --> go2[(proceed, always)]:::ok
```

No `push`, no `pull_request`, no `workflow_run`. The daily cron is the only trigger that fires automatically, in the same early-morning UTC window used by `agent-run`, `coder-run`, and `update-prs-with-development`. Manual dispatch is always available for an immediate refresh.

[Back to top](#navigate)

---

## 3. The one-job DAG

```mermaid
flowchart TB
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000

    subgraph J["refresh job (ubuntu-latest, timeout 10m)"]
        direction TB
        s1["Generate bot token"]:::step
        s2["Checkout development<br/>with bot token"]:::step
        s3["Configure git<br/>(llm-exe-bot[bot])"]:::step
        s4["Run .github/vitals/generate.sh AUTOMATION.md"]:::step
        s5["git diff --quiet AUTOMATION.md"]:::step
        s6["commit + push if changed<br/>(message contains [skip ci])"]:::step

        s1 --> s2 --> s3 --> s4 --> s5 --> s6
    end
```

Concurrency group is `vitals` with `cancel-in-progress: true`. If the daily cron and a manual dispatch overlap, the dispatch wins.

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant E as Event (cron or dispatch)
    participant J as refresh job
    participant T as Token mint
    participant G as Git
    participant Gen as generate.sh
    participant GH as gh CLI
    participant API as api.github.com
    participant Out as AUTOMATION.md

    E->>J: dispatch / schedule
    J->>T: create-github-app-token@v3
    T-->>J: bot token (short-lived)
    J->>G: checkout development with bot token
    J->>G: git config llm-exe-bot[bot]
    J->>Gen: bash .github/vitals/generate.sh AUTOMATION.md
    Gen->>GH: gh repo view (resolve owner/repo)
    Gen->>GH: gh pr list (open bot PRs, stale &gt; 72h)
    Gen->>GH: gh issue list (open count, needs-discussion, breaking)
    Gen->>GH: gh release list --limit 1
    Gen->>GH: gh pr list base main head development
    GH->>API: REST calls
    API-->>GH: JSON responses
    Gen->>Gen: walk scripts/agents/logs/*/ for activity counts
    Gen->>Out: write template + workflow table + activity + health + release + links
    J->>G: git diff --quiet AUTOMATION.md
    Note over J: if no diff, exit early with notice
    J->>G: git add + commit "chore: refresh automation vitals [skip ci]"
    J->>G: git push origin development (with rebase-retry on failure)
```

[Back to top](#navigate)

---

## 5. Anatomy of AUTOMATION.md

The generator emits the file in five sections, in this order, every time.

```mermaid
flowchart TB
    classDef hdr fill:#0e7490,color:#fff,stroke:#000
    classDef sec fill:#1e3a8a,color:#fff,stroke:#000

    H["Header<br/>title + refresh timestamp + edit warning"]:::hdr
    S1["1. At a glance<br/>5-node topology mermaid"]:::sec
    S2["2. Workflow status<br/>table of every workflow with shields.io badge"]:::sec
    S3["3. Agent activity (last 7 days)<br/>table of agent runs + most recent status (from log files)"]:::sec
    S4["4. Health checks<br/>OK / WARN / INFO list (stale PRs, backlog caps, label counts)"]:::sec
    S5["5. Release status<br/>last published tag + next release queue PR"]:::sec
    S6["6. Quick links<br/>jump to architecture, index, and key deep dives"]:::sec

    H --> S1 --> S2 --> S3 --> S4 --> S5 --> S6
```

[Back to top](#navigate)

---

## 6. Data sources

```mermaid
flowchart LR
    classDef src fill:#374151,color:#fff,stroke:#000
    classDef gen fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph Local["Local filesystem"]
        L1[".github/workflows/*.yml<br/>(workflow list)"]:::src
        L2["scripts/agents/logs/&lt;agent&gt;/*.md<br/>(run history)"]:::src
        L3["scripts/agents/logs/personas/&lt;name&gt;/*.md<br/>(persona history)"]:::src
    end

    subgraph Remote["GitHub API (via gh)"]
        R1["pr list bot author + created &lt; 72h ago"]:::src
        R2["pr list open count"]:::src
        R3["issue list open + by label"]:::src
        R4["release list --limit 1"]:::src
        R5["pr list base main head development"]:::src
    end

    G["generate.sh"]:::gen

    L1 --> G
    L2 --> G
    L3 --> G
    R1 --> G
    R2 --> G
    R3 --> G
    R4 --> G
    R5 --> G

    G --> O["AUTOMATION.md"]:::out
```

Every `gh` call is wrapped with a fallback so transient errors degrade gracefully instead of crashing the script.

[Back to top](#navigate)

---

## 7. Why the badges work

The workflow status table uses [shields.io](https://shields.io) badge URLs. The benefit is the rendered status stays correct between vitals runs.

```mermaid
sequenceDiagram
    autonumber
    participant V as Viewer (GitHub web UI)
    participant GH as GitHub markdown renderer
    participant SH as img.shields.io
    participant API as api.github.com

    V->>GH: open AUTOMATION.md
    GH->>V: render markdown
    Note over GH: encounters image URL\nhttps://img.shields.io/...
    GH->>SH: GET badge.svg
    SH->>API: query latest run status
    API-->>SH: JSON
    SH-->>GH: SVG (cached briefly)
    GH-->>V: badge image displayed
```

So the table itself is static text but the badges show fresh status on every view, without re-running the workflow.

[Back to top](#navigate)

---

## 8. Security boundaries

```mermaid
flowchart LR
    classDef src fill:#7c2d12,color:#fff,stroke:#000
    classDef guard fill:#064e3b,color:#fff,stroke:#000

    R1["Bot PR title could contain<br/>markdown control chars<br/>(via prompt injection from issues)"]:::src
    R2["Agent log Status line<br/>could be tampered with<br/>(by a misbehaving agent)"]:::src
    R3["Bot token over-scope<br/>could let a compromised script<br/>do more damage"]:::src

    G1["Guard: md_escape() in generate.sh<br/>escapes \\|, \\[, \\], backtick, backslash<br/>and collapses newlines"]:::guard
    G2["Guard: same md_escape() applied to<br/>every status value before output"]:::guard
    G3["Guard: least-privilege permissions block<br/>contents:write, PR:read, issues:read only.<br/>No id-token, no actions, no PR/issues write."]:::guard

    R1 -. blocked by .-> G1
    R2 -. blocked by .-> G2
    R3 -. blocked by .-> G3
```

The generator is the rendering boundary. Untrusted strings (bot PR titles, release names, agent status values) all flow through `md_escape` before they reach `AUTOMATION.md`. The bot's permissions in the workflow match exactly what `gh` and `git push` need, and nothing more.

[Back to top](#navigate)

---

## 9. Loop prevention

```mermaid
flowchart LR
    classDef risk fill:#7c2d12,color:#fff,stroke:#000
    classDef guard fill:#064e3b,color:#fff,stroke:#000

    R1["The push commit might<br/>retrigger workflows"]:::risk
    R2["The push might retrigger<br/>vitals itself"]:::risk
    R3["docs-sync might catch the<br/>AUTOMATION.md change"]:::risk

    G1["Guard 1: [skip ci] in commit<br/>message tells GitHub Actions<br/>to skip all workflows"]:::guard
    G2["Guard 2: vitals has no push<br/>trigger. It only listens to<br/>cron and dispatch."]:::guard
    G3["Guard 3: AUTOMATION.md is at the<br/>repo root. docs-sync paths<br/>filter does not include it."]:::guard

    R1 -. blocked by .-> G1
    R2 -. blocked by .-> G2
    R3 -. blocked by .-> G3
```

[Back to top](#navigate)

---

## 10. External calls

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef gh fill:#1f2937,color:#fff,stroke:#000
    classDef cdn fill:#064e3b,color:#fff,stroke:#000

    subgraph Pre["Before the script"]
        c1["actions/create-github-app-token@v3<br/>auth: APP_CLIENT_ID + APP_PRIVATE_KEY<br/>why: bot identity for git push"]:::pre
        c2["actions/checkout@v6<br/>auth: bot token<br/>why: get development branch tip"]:::pre
    end

    subgraph During["While the script runs"]
        d1["api.github.com via gh CLI<br/>auth: bot token<br/>endpoints: pr/list, issue/list,<br/>release/list, repo/view"]:::gh
        d2["origin remote (git push)<br/>auth: bot token<br/>destination: development"]:::gh
    end

    subgraph Render["When a human views AUTOMATION.md"]
        v1["img.shields.io<br/>auth: anonymous<br/>queries: GitHub Actions workflow status"]:::cdn
    end

    c1 --> c2 --> d1
    d1 --> d2
    v1 -. lazy, only on view .-> d1
```

[Back to top](#navigate)

---

## 11. Output cascade

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef noop fill:#374151,color:#fff,stroke:#000

    V["vitals refresh"]:::src
    V --> A["commit to development<br/>AUTOMATION.md change<br/>message: [skip ci]"]:::out

    A --> C1["repo viewers see live state<br/>(GitHub web UI, mobile app, IDE)"]:::cons
    A --> C2["shields.io badges<br/>always reflect latest CI runs<br/>(no vitals trigger needed)"]:::cons

    A --> N1["NO downstream workflow triggers<br/>(skip ci + no path matches)"]:::noop
```

[Back to top](#navigate)

---

## 12. State machine

```mermaid
stateDiagram-v2
    [*] --> Queued: cron or dispatch fires
    Queued --> ActorChecking: refresh job starts
    ActorChecking --> Skipped: actor is the bot (cron path only)
    ActorChecking --> Booting: actor is the scheduler or a human dispatcher
    Booting --> Setup: token mint + checkout + git config
    Setup --> Generating: run generate.sh
    Generating --> Generated: AUTOMATION.md written
    Generated --> Diffing: git diff --quiet
    Diffing --> NoChange: exit cleanly
    Diffing --> Committing: changes detected
    Committing --> Pushing: git push origin development
    Pushing --> Pushed: success
    Pushing --> Rebasing: push rejected (race)
    Rebasing --> Pushing: pull --rebase + retry
    Pushed --> [*]
    NoChange --> [*]
    Skipped --> [*]
```

[Back to top](#navigate)

---

## 13. Failure modes

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["gh API rate limited"]:::fail
    F1 --> F1E["each call has a fallback default<br/>(empty array, 0, or null)"]:::effect
    F1X["sections show neutral values<br/>next daily run reconciles"]:::fix
    F1E --> F1X

    F2["Push rejected due to race<br/>(another commit landed)"]:::fail
    F2 --> F2E["workflow runs git pull --rebase<br/>and retries push once"]:::effect
    F2X["script exits clean on second push"]:::fix
    F2E --> F2X

    F3["generate.sh exits non-zero"]:::fail
    F3 --> F3E["job fails<br/>AUTOMATION.md is NOT committed"]:::effect
    F3X["prior version of file remains live<br/>maintainer investigates job logs"]:::fix
    F3E --> F3X

    F4["No changes since last run"]:::fail
    F4 --> F4E["git diff --quiet exits 0<br/>job emits notice and exits"]:::effect
    F4X["intentional: no noisy commit"]:::fix
    F4E --> F4X

    F5["Workflow file added or removed<br/>between vitals runs"]:::fail
    F5 --> F5E["table reflects the change<br/>on the next refresh<br/>(at most one hour stale)"]:::effect
    F5X["acceptable; docs-sync also fires<br/>on the same source change"]:::fix
    F5E --> F5X
```

[Back to top](#navigate)

---

## 14. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["Workflow file"]:::k --- V1[".github/workflows/vitals.yml"]:::v
    K2["Generator"]:::k --- V2[".github/vitals/generate.sh"]:::v
    K3["Output"]:::k --- V3["AUTOMATION.md at repo root"]:::v
    K4["Triggers"]:::k --- V4["cron 0 8 * * * + workflow_dispatch"]:::v
    K5["Permissions"]:::k --- V5["contents: write, pull-requests: read, issues: read"]:::v
    K6["Timeout"]:::k --- V6["10 minutes"]:::v
    K7["Concurrency"]:::k --- V7["vitals, cancel-in-progress: true"]:::v
    K8["Identity"]:::k --- V8["llm-exe-bot[bot] via App token"]:::v
    K9["Commit message"]:::k --- V9["chore: refresh automation vitals [skip ci]"]:::v
    K10["Loop guard"]:::k --- V10["no push trigger + [skip ci] + path is at repo root"]:::v
    K11["Cost"]:::k --- V11["1 run/day, ~30s each, ~0.5 GH minutes/day"]:::v
```

Direct links:

- Workflow file: [.github/workflows/vitals.yml](../workflows/vitals.yml)
- Generator script: [.github/vitals/generate.sh](../vitals/generate.sh)
- Live output: [AUTOMATION.md](../../AUTOMATION.md)
- Companion docs: [WORKFLOWS_INDEX.md](WORKFLOWS_INDEX.md), [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md), [DOCS_SYNC_DEEP_DIVE.md](DOCS_SYNC_DEEP_DIVE.md)

[Back to top](#navigate)
