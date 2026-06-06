# docs-sync: Visual Deep Dive

Concentrated diagrams for [.github/workflows/docs-sync.yml](../workflows/docs-sync.yml). Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md) and the template at [AGENT_RUN_DEEP_DIVE.md](AGENT_RUN_DEEP_DIVE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers and what each one does](#2-triggers-and-what-each-one-does)
- [3. Loop prevention](#3-loop-prevention)
- [4. Inputs and how they shape the run](#4-inputs-and-how-they-shape-the-run)
- [5. The sync job steps](#5-the-sync-job-steps)
- [6. Step-by-step lifecycle](#6-step-by-step-lifecycle)
- [7. Diff detection logic](#7-diff-detection-logic)
- [8. File-to-doc routing](#8-file-to-doc-routing)
- [9. Anatomy of the prompt](#9-anatomy-of-the-prompt)
- [10. Filesystem reads and writes](#10-filesystem-reads-and-writes)
- [11. External calls](#11-external-calls)
- [12. Output cascade](#12-output-cascade)
- [13. The state machine](#13-the-state-machine)
- [14. Failure modes](#14-failure-modes)
- [15. Quick reference card](#15-quick-reference-card)
- [16. Security boundaries](#16-security-boundaries)

---

## 1. The whole picture

How [docs-sync.yml](../workflows/docs-sync.yml) plugs into the rest of the system.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        d1["workflow_dispatch\ninputs.target or inputs.full_refresh"]:::trig
    end

    subgraph A["docs-sync.yml"]
        S["sync job\ntimeout 30m"]:::job
    end

    subgraph SRC["Watched source paths (used by diff detection)"]
        s1[".github/workflows/**"]:::file
        s2[".github/actions/**"]:::file
        s3[".github/vitals/**"]:::file
        s4["scripts/maintain.sh"]:::file
        s5["scripts/agents/config.sh"]:::file
        s6["scripts/agents/prompts/**"]:::file
        s7["package.json"]:::file
    end

    subgraph F["Files read/written"]
        cfg["scripts/agents/config.sh"]:::file
        pr["scripts/agents/prompts/docs-sync.md"]:::file
        cf["/tmp/changed-files.txt"]:::file
        tmp["/tmp/agent-prompt.txt"]:::file
        lg["scripts/agents/logs/docs-sync/*.md"]:::file
        deepdives[".github/docs/*_DEEP_DIVE.md\n.github/docs/WORKFLOWS_INDEX.md\n.github/docs/WORKFLOW_ARCHITECTURE.md"]:::out
    end

    subgraph X["External"]
        gh["GitHub API\n(PRs, optionally issues)"]:::ext
        ant["Anthropic Claude\nvars.ANTHROPIC_OPUS_LATEST\n(default: claude-opus-4-6)"]:::ext
    end

    subgraph DOWN["Downstream"]
        rev["agent-review-pr.yml\nfires on opened agent/* PR"]:::job
        tst["tests.yml\nfires on PR open/sync\n(docs-only changes still test)"]:::job
        maint["maintainer merges PR"]:::out
    end

    d1 --> S
    S --> cfg
    cfg --> pr
    pr --> tmp
    S --> cf
    cf --> tmp
    tmp --> ant
    ant --> deepdives
    ant --> gh
    S --> lg
    deepdives --> gh
    gh --> rev
    gh --> tst
    rev --> maint
```

[Back to top](#navigate)

---

## 2. Triggers and what each one does

The workflow only accepts `workflow_dispatch`. Push detection is handled by a separate trigger workflow (`docs-sync-trigger.yml`) that dispatches this workflow with the changed file list pre-computed. This separation exists because `claude-code-action@v1` does not support the `push` event type.

```mermaid
flowchart TB
    classDef manual fill:#9333ea,color:#fff,stroke:#000
    classDef skip fill:#7c2d12,color:#fff,stroke:#000

    start([workflow_dispatch event])
    start --> fr{inputs.full_refresh?}

    fr -->|yes| run1[(list ALL tracked source files\naudits every deep dive)]:::manual

    fr -->|no| ti{inputs.target set?}
    ti -->|yes| run2[(use the comma-separated list verbatim)]:::manual
    ti -->|no| run3[(diff base = HEAD~1 or event.before\ndiff head = HEAD)]:::manual

    run1 --> proceed[(run sync job)]:::manual
    run2 --> proceed
    run3 --> proceed
```

Source: [.github/workflows/docs-sync.yml](../workflows/docs-sync.yml) lines 10-22 (trigger + inputs).

[Back to top](#navigate)

---

## 3. Loop prevention

This workflow cannot retrigger itself because it only fires on `workflow_dispatch`, never on `push`. The bot's doc edits merge to `development` but that merge event does not dispatch this workflow. Two independent guards reinforce this.

```mermaid
flowchart LR
    classDef risk fill:#7c2d12,color:#fff,stroke:#000
    classDef guard fill:#064e3b,color:#fff,stroke:#000

    R1["Bot PR merges include\n.github/*_DEEP_DIVE.md edits"]:::risk
    R2["Bot PR merges include\nscripts/agents/logs/docs-sync/*.md"]:::risk

    G1["Guard 1: trigger is dispatch-only\nno push trigger exists on this workflow"]:::guard
    G2["Guard 2: diff detection pathspec\nis an allowlist of source paths only\n(workflows/actions/vitals/prompts/config/maintain/package.json)"]:::guard

    R1 -. blocked by .-> G1
    R2 -. blocked by .-> G2
```

Push detection is handled by a separate trigger workflow (`docs-sync-trigger.yml`) that only dispatches when workflow/action/script source files change, not when doc markdown changes.

[Back to top](#navigate)

---

## 4. Inputs and how they shape the run

```mermaid
flowchart LR
    classDef inp fill:#7c2d12,color:#fff,stroke:#000
    classDef use fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    subgraph Inputs
        I1["inputs.full_refresh\n(boolean, default false)"]:::inp
        I2["inputs.target\n(comma-separated paths, optional)"]:::inp
        I3["github.event.before\n(when dispatched by trigger workflow)"]:::inp
    end

    subgraph Effects
        E1["Lists ALL tracked source files\noverrides inputs.target"]:::use
        E2["Bypasses git diff\nuses provided list verbatim"]:::use
        E3["Selects diff base\n(github.event.before vs HEAD~1)"]:::use
    end

    subgraph Outputs
        O1["Full audit of every deep dive\nfor comprehensive drift detection"]:::out
        O2["Targeted sync for specific files\n(manual escape hatch)"]:::out
        O3["Correct diff range\nacross merge commits and squash merges"]:::out
    end

    I1 --> E1 --> O1
    I2 --> E2 --> O2
    I3 --> E3 --> O3
```

When `full_refresh` is true, the detect step enumerates every tracked source file (all workflows, actions, vitals, scripts, prompts, and package.json) so the agent audits all deep dives for drift regardless of what recently changed. This overrides `inputs.target`.

[Back to top](#navigate)

---

## 5. The sync job steps

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000

    start([Workflow event])
    start --> J1

    subgraph J1["Job: sync (ubuntu-latest, timeout-minutes: 30)"]
        direction TB
        r1["Generate bot token"]:::step
        r2["Checkout fetch-depth: 0\nwith bot token"]:::step
        r3["Configure git\nuser.name = llm-exe-bot[bot]"]:::step
        r4["actions/setup-node@v4\nnode-version: 20, cache: npm"]:::step
        r5["npm ci"]:::step
        r6["Detect changed files\n(writes /tmp/changed-files.txt)"]:::step
        r7["Skip if nothing relevant changed"]:::step
        r8["Build prompt\n(only if count != 0)"]:::step
        r9["Run docs-sync agent\nclaude-code-action@v1\nmodel configurable, max-turns 80"]:::step
        r10["Upload agent prompt\n(artifact, 7-day retention)"]:::step
        r11["Clock out (if: always())"]:::step
        r1 --> r2 --> r3 --> r4 --> r5 --> r6 --> r7 --> r8 --> r9 --> r10 --> r11
    end
```

Concurrency group is `docs-sync` with `cancel-in-progress: false`. Two pushes in quick succession queue rather than cancel.

[Back to top](#navigate)

---

## 6. Step-by-step lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant E as Event (push or dispatch)
    participant J as sync job
    participant T as Token mint
    participant G as Git
    participant N as Node + npm
    participant Det as Detect step
    participant CF as /tmp/changed-files.txt
    participant C as config.sh
    participant P as prompts/docs-sync.md
    participant L as logs/docs-sync/
    participant TMP as /tmp/agent-prompt.txt
    participant CCA as claude-code-action@v1
    participant API as Anthropic + GitHub

    E->>J: dispatch / push
    J->>T: create-github-app-token@v1
    T-->>J: bot token (short-lived)
    J->>G: checkout fetch-depth 0
    J->>G: git config llm-exe-bot[bot]
    J->>N: setup-node + npm ci
    J->>Det: run diff
    Det->>G: git diff (base, HEAD)
    G-->>Det: changed paths
    Det->>CF: write list
    Note over Det: if count == 0, exit early
    J->>C: source config.sh
    C->>G: create_agent_branch docs-sync
    G-->>C: agent/docs-sync/(date)
    C->>L: clock_in writes skeleton .md
    C->>P: sed substitute BRANCH and LOG_FILE
    C->>L: build_prior_context (last 3 logs)
    C->>CF: cat changed-files.txt
    C->>TMP: write prompt + prior context + time budget + changed files
    J->>CCA: run with /tmp/agent-prompt.txt
    CCA->>API: streaming inference (vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6)
    API-->>CCA: tool calls (Read, Edit, Bash, Grep)
    CCA->>CCA: map source files to deep dives via lookup table
    CCA->>CCA: Edit deep dive sections in place
    CCA->>CCA: grep verify no em dashes
    CCA->>G: commit and push origin agent/docs-sync/(date)
    CCA->>API: gh pr create --base development
    CCA->>L: rewrite Summary, Files Changed, Next Steps
    J->>C: clock_out (if: always())
    C->>L: stamp Finished UTC + Status
```

[Back to top](#navigate)

---

## 7. Diff detection logic

```mermaid
flowchart TB
    classDef cond fill:#7c2d12,color:#fff,stroke:#000
    classDef act fill:#1e3a8a,color:#fff,stroke:#000

    start([Detect step starts])
    start --> q0{inputs.full_refresh == true?}
    q0 -->|yes| a0["find all tracked source files\n(workflows, actions, vitals,\nmaintain.sh, config.sh, prompts,\npackage.json)\n> /tmp/changed-files.txt"]:::act
    q0 -->|no| q1{inputs.target non-empty?}
    q1 -->|yes| a1["echo target | tr ',' '\\n' | trim |\nfilter empty > /tmp/changed-files.txt"]:::act
    q1 -->|no| q2{github.event.before is empty\nor all zeros?}
    q2 -->|yes| a2["base = HEAD~1"]:::act
    q2 -->|no| a3["base = github.event.before"]:::act
    a2 --> a4["git diff --name-only base HEAD --\n.github/workflows/\n.github/actions/\n.github/vitals/\nscripts/maintain.sh\nscripts/agents/config.sh\nscripts/agents/prompts/\npackage.json\n> /tmp/changed-files.txt"]:::act
    a3 --> a4
    a0 --> a5["count = wc -l < /tmp/changed-files.txt"]:::act
    a1 --> a5
    a4 --> a5
    a5 --> q3{count == 0?}
    q3 -->|yes| stop([exit early, no agent run]):::cond
    q3 -->|no| go[(continue to prompt build)]:::act
```

The pathspec on the diff is a defense-in-depth: even if a future maintainer broadens the trigger's `paths` filter, the diff itself stays narrow.

[Back to top](#navigate)

---

## 8. File-to-doc routing

This is the table the agent consults to decide what to update. It lives inside [scripts/agents/prompts/docs-sync.md](../../scripts/agents/prompts/docs-sync.md) so future edits do not require workflow changes.

```mermaid
flowchart LR
    classDef src fill:#374151,color:#fff,stroke:#000
    classDef one fill:#1e3a8a,color:#fff,stroke:#000
    classDef many fill:#581c87,color:#fff,stroke:#000

    subgraph Source["Source paths"]
        s1[".github/workflows/&lt;name&gt;.yml"]:::src
        s2[".github/actions/&lt;name&gt;/action.yml"]:::src
        s3["scripts/agents/config.sh"]:::src
        s4["scripts/agents/prompts/&lt;agent&gt;.md"]:::src
        s5["scripts/agents/prompts/_persona.md"]:::src
        s6["scripts/agents/prompts/personas/&lt;name&gt;.md"]:::src
        s7["scripts/maintain.sh"]:::src
        s8["package.json"]:::src
    end

    subgraph Target["Deep dive targets"]
        t1["&lt;UPPER_NAME&gt;_DEEP_DIVE.md"]:::one
        t2["every deep dive that names this action"]:::many
        t3["every agent deep dive (config.sh is shared)"]:::many
        t4["&lt;UPPER_AGENT&gt;_DEEP_DIVE.md"]:::one
        t5["PERSONAS_RUN_DEEP_DIVE.md"]:::one
        t6["PERSONAS_RUN_DEEP_DIVE.md"]:::one
        t7["every agent deep dive (entry point)"]:::many
        t8["only deep dives mentioning the changed npm script"]:::many
    end

    s1 --> t1
    s2 --> t2
    s3 --> t3
    s4 --> t4
    s5 --> t5
    s6 --> t6
    s7 --> t7
    s8 --> t8

    Source -.macro changes.-> idx["WORKFLOWS_INDEX.md\nWORKFLOW_ARCHITECTURE.md"]:::many
```

A workflow added or removed always cascades into [WORKFLOWS_INDEX.md](WORKFLOWS_INDEX.md) and [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

[Back to top](#navigate)

---

## 9. Anatomy of the prompt

```mermaid
flowchart TB
    classDef l1 fill:#0e7490,color:#fff,stroke:#000
    classDef l2 fill:#155e75,color:#fff,stroke:#000
    classDef l3 fill:#7c2d12,color:#fff,stroke:#000
    classDef l4 fill:#581c87,color:#fff,stroke:#000

    A["LAYER 1: Role template\nscripts/agents/prompts/docs-sync.md\nwith $BRANCH and $LOG_FILE substituted"]:::l1
    B["LAYER 2: Prior runs\nlast 3 logs from logs/docs-sync/\nunder ## Prior Runs header"]:::l2
    C["LAYER 3: Time Budget\nstart UTC + deadline UTC + 600s"]:::l3
    D["LAYER 4: Changed Source Files\nthe verbatim contents of /tmp/changed-files.txt\nunder ## Changed Source Files header"]:::l4

    A --> X[("write /tmp/agent-prompt.txt")]
    B --> X
    C --> X
    D --> X
    X --> R[("Claude reads it as its only prompt")]
```

Unlike most agents, docs-sync always has a fourth layer (the diff list). It is the agent's primary input. Without it the agent has nothing to react to.

[Back to top](#navigate)

---

## 10. Filesystem reads and writes

```mermaid
flowchart LR
    classDef read fill:#1e3a8a,color:#fff,stroke:#000
    classDef write fill:#9a3412,color:#fff,stroke:#000
    classDef both fill:#581c87,color:#fff,stroke:#000

    subgraph reads["READ"]
        r1["CLAUDE.md"]:::read
        r2["scripts/agents/config.sh"]:::read
        r3["scripts/agents/prompts/docs-sync.md"]:::read
        r4["the changed source files\n(workflows, actions, scripts, prompts)"]:::read
        r5["the existing deep dives\n(.github/docs/*_DEEP_DIVE.md)"]:::read
        r6[".github/docs/WORKFLOWS_INDEX.md\n.github/docs/WORKFLOW_ARCHITECTURE.md"]:::read
    end

    subgraph writes["WRITE"]
        w1["agent/docs-sync/&lt;date&gt;\nfresh git branch"]:::write
        w2[".github/docs/*_DEEP_DIVE.md\n(only those affected by the diff)"]:::write
        w3[".github/docs/WORKFLOWS_INDEX.md\n(if structure changed)"]:::write
        w4[".github/docs/WORKFLOW_ARCHITECTURE.md\n(if structure changed)"]:::write
        w5["/tmp/agent-prompt.txt\n/tmp/changed-files.txt"]:::write
        w6["GitHub PR\ngh pr create --base development"]:::write
    end

    subgraph both["READ + WRITE"]
        b1["scripts/agents/logs/docs-sync/*.md"]:::both
    end

    r4 --> w2
    r5 --> w2
    r6 --> w3
    r6 --> w4
    r2 --> b1
```

The agent must NEVER write under `.github/workflows/`, `.github/actions/`, or `scripts/`. The prompt enforces this; the reviewer agent will reject any PR that does.

[Back to top](#navigate)

---

## 11. External calls

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef llm fill:#581c87,color:#fff,stroke:#000
    classDef gh fill:#1f2937,color:#fff,stroke:#000

    subgraph Pre["Before the agent starts"]
        c1["actions/create-github-app-token@v1\nauth: APP_ID + APP_PRIVATE_KEY\nwhy: bot identity so PR triggers reviewer"]:::pre
        c2["actions/checkout@v4\nauth: bot token\nwhy: full history for git diff"]:::pre
        c3["actions/setup-node@v4\nauth: none\nwhy: install Node 20, cache npm"]:::pre
    end

    subgraph During["While the agent runs"]
        d1["api.anthropic.com\nauth: CLAUDE_CODE_OAUTH_TOKEN\nmodel: vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6\n--max-turns 80"]:::llm
        d2["api.github.com (gh CLI)\nauth: bot token\nwhy: gh pr create, optionally gh issue create"]:::gh
        d3["origin remote (git push)\nauth: bot token\nwhy: push agent/docs-sync/&lt;date&gt;"]:::gh
    end

    c1 --> c2 --> c3 --> d1 --> d2
    d1 --> d3
```

Tool allowlist: `Bash,Read,Write,Edit,Glob,Grep,WebFetch`. No `WebSearch` is needed; the agent only reads local files. Model is configurable via `vars.ANTHROPIC_OPUS_LATEST`, defaulting to `claude-opus-4-6`.

[Back to top](#navigate)

---

## 12. Output cascade

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    DS["docs-sync run completes"]:::src

    DS --> O1["branch agent/docs-sync/&lt;date&gt;"]:::out
    DS --> O2["PR to development\ntitle: docs: sync workflow deep dives"]:::out
    DS --> O3["log committed at\nscripts/agents/logs/docs-sync/&lt;ts&gt;.md"]:::out

    O2 --> C1["agent-review-pr.yml\nfires on opened agent/* PR"]:::cons
    O2 --> C2["tests.yml\nfires on PR open\n(docs-only change passes trivially)"]:::cons

    O3 --> C3["next docs-sync run\nreads it under Prior Runs"]:::cons
    O3 --> C4["agent-digest.yml\nweekly summary mentions docs-sync"]:::cons

    C1 --> H1{verdict}:::cons
    H1 -->|approve| C5["maintainer merges PR"]:::human
    H1 -->|request changes| DS
    H1 -.close.-> X[("rare, but possible")]

    C5 --> noop["merge touches only .github/*.md\npath filter does NOT match\nno re-trigger"]:::cons
```

The "no re-trigger" terminus is intentional and load-bearing. See [section 3](#3-loop-prevention).

[Back to top](#navigate)

---

## 13. The state machine

```mermaid
stateDiagram-v2
    [*] --> Queued: event arrives
    Queued --> Booting: sync job starts
    Booting --> Setup: checkout + node + npm ci
    Setup --> Detecting: git diff against base
    Detecting --> NoChanges: count == 0
    Detecting --> PromptBuilt: count > 0, config.sh assembles prompt
    PromptBuilt --> Running: claude-code-action started
    Running --> Working: Read, Edit, Bash, Grep
    Working --> Working: loop until done or limit
    Working --> Verified: grep finds no em dashes
    Verified --> PRCreated: gh pr create succeeded
    Working --> NoOutput: no docs need updating
    PRCreated --> Logging: write Summary
    NoOutput --> Logging
    Logging --> ClockOut: status mapped to exit code
    ClockOut --> Completed: exit 0
    ClockOut --> Interrupted: any non-zero
    Working --> TimedOut: 30-minute timeout or max-turns 80
    TimedOut --> ClockOut
    NoChanges --> [*]
    Skipped --> [*]
    Completed --> [*]
    Interrupted --> [*]
```

`if: always()` on the clock-out step means even `TimedOut` and `Interrupted` paths stamp a finish time. The log file is never left in `running` state.

[Back to top](#navigate)

---

## 14. Failure modes

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F2["Bot's doc PR merges, touches only .github/*.md"]:::fail
    F2 --> F2E["paths filter does NOT match\nno re-trigger"]:::effect
    F2X["intentional: primary loop guard"]:::fix
    F2E --> F2X

    F3["github.event.before is all zeros\n(first push to dev)"]:::fail
    F3 --> F3E["detect step falls back to HEAD~1"]:::effect
    F3X["intentional: avoids git diff crash"]:::fix
    F3E --> F3X

    F4["Workflow file changed but its doc\ndoes not exist yet"]:::fail
    F4 --> F4E["agent prompt 'Edge cases' section\nsays: create the doc from template"]:::effect
    F4X["agent bootstraps the new deep dive"]:::fix
    F4E --> F4X

    F5["Agent leaves em dashes in updated doc"]:::fail
    F5 --> F5E["prompt enforces grep verify\nbefore commit"]:::effect
    F5X["reviewer catches if agent skipped step"]:::fix
    F5E --> F5X

    F6["Many files changed in one push\n(e.g. config.sh + 4 workflows)"]:::fail
    F6 --> F6E["agent updates the most-impacted docs first\nlogs the rest under Next Steps"]:::effect
    F6X["next run picks up via Prior Runs"]:::fix
    F6E --> F6X

    F7["Agent goes out of scope\n(edits a workflow file or script)"]:::fail
    F7 --> F7E["reviewer agent --request-changes or close"]:::effect
    F7X["prompt forbids it; reviewer enforces"]:::fix
    F7E --> F7X

```

[Back to top](#navigate)

---

## 15. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/docs-sync.yml"]:::v
    K2["Triggers"]:::k --- V2["workflow_dispatch only (push detection in separate trigger workflow)"]:::v
    K3["Inputs"]:::k --- V3["target (comma-separated paths), full_refresh (boolean)"]:::v
    K4["Path filter"]:::k --- V4["workflows, actions, maintain.sh, config.sh, prompts, package.json"]:::v
    K5["Permissions"]:::k --- V5["contents/PR/issues: write"]:::v
    K6["Timeout"]:::k --- V6["30 minutes"]:::v
    K7["Concurrency"]:::k --- V7["docs-sync, no cancel"]:::v
    K8["Identity"]:::k --- V8["llm-exe-bot[bot] via App token"]:::v
    K9["Model"]:::k --- V9["vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6"]:::v
    K10["Max turns"]:::k --- V10["80"]:::v
    K11["Tool allowlist"]:::k --- V11["Bash, Read, Write, Edit, Glob, Grep, WebFetch"]:::v
    K12["Branch"]:::k --- V12["agent/docs-sync/&lt;YYYY-MM-DD&gt;"]:::v
    K13["Log path"]:::k --- V13["scripts/agents/logs/docs-sync/&lt;ts&gt;.md"]:::v
    K14["Prompt file"]:::k --- V14["scripts/agents/prompts/docs-sync.md"]:::v
    K15["Diff carrier"]:::k --- V15["/tmp/changed-files.txt"]:::v
    K16["Base branch for PRs"]:::k --- V16["development"]:::v
```

Direct links:

- Workflow file: [.github/workflows/docs-sync.yml](../workflows/docs-sync.yml)
- Prompt template: [scripts/agents/prompts/docs-sync.md](../../scripts/agents/prompts/docs-sync.md)
- Local runner: `./scripts/maintain.sh docs-sync` ([scripts/maintain.sh](../../scripts/maintain.sh))
- Log directory: [scripts/agents/logs/docs-sync/](../../scripts/agents/logs/docs-sync/)
- Companion docs: [WORKFLOWS_INDEX.md](WORKFLOWS_INDEX.md), [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md), [AGENT_RUN_DEEP_DIVE.md](AGENT_RUN_DEEP_DIVE.md)

[Back to top](#navigate)

---

## 16. Security boundaries

```mermaid
flowchart LR
    classDef risk fill:#7c2d12,color:#fff,stroke:#000
    classDef guard fill:#064e3b,color:#fff,stroke:#000

    R1["Adversarial workflow file content<br/>could prompt-inject the agent"]:::risk
    R2["Agent has Bash + Write + Edit<br/>so could in theory touch source"]:::risk
    R3["Bot token over-scope<br/>could expand blast radius"]:::risk

    G1["Guard: only maintainers can merge to<br/>development. Adversarial content reaches<br/>the agent only via a maintainer-approved merge."]:::guard
    G2["Guard: prompt enforces scope in plain text;<br/>reviewer agent (read-only tools) reviews every<br/>doc-sync PR before merge."]:::guard
    G3["Guard: least-privilege permissions block.<br/>contents:write, PR:write, issues:write only.<br/>No id-token, no actions write."]:::guard

    R1 -. blocked by .-> G1
    R2 -. blocked by .-> G2
    R3 -. blocked by .-> G3
```

Defense in depth:

| Boundary | Mechanism |
|----------|-----------|
| Triggering | Only fires on `workflow_dispatch` (no push trigger on this workflow). Push detection is handled by a separate trigger workflow. No PR or `issue_comment` triggers. Loop prevention is inherent: dispatch-only means the bot's own merged output cannot retrigger this workflow. See [section 3](#3-loop-prevention). |
| Scope | Prompt explicitly forbids touching `.github/workflows/`, `.github/actions/`, `scripts/`, `src/`, `docs/`, `package.json`. |
| Verification | Reviewer agent ([AGENT_REVIEW_PR_DEEP_DIVE.md](AGENT_REVIEW_PR_DEEP_DIVE.md)) reads every `agent/*` PR before merge. Its tool allowlist is read-only so it cannot be prompt-injected to make changes. |
| Token scope | App-minted token with `contents`, `pull-requests`, and `issues` write. No `id-token`, no `actions`, no admin. |
| Loop guards | See [section 3](#3-loop-prevention). |

[Back to top](#navigate)
