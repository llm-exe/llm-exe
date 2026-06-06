# Agent Run: Visual Deep Dive

Concentrated diagrams for [.github/workflows/agent-run.yml](../workflows/agent-run.yml) and the sibling workflows it depends on. Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers and what each one does](#2-triggers-and-what-each-one-does)
- [3. Inputs and how they shape the run](#3-inputs-and-how-they-shape-the-run)
- [4. The two-job DAG](#4-the-two-job-dag)
- [5. Step-by-step lifecycle](#5-step-by-step-lifecycle)
- [6. Anatomy of the prompt](#6-anatomy-of-the-prompt)
- [7. Filesystem reads and writes](#7-filesystem-reads-and-writes)
- [8. External calls](#8-external-calls)
- [9. Per-agent path differences](#9-per-agent-path-differences)
- [10. Output cascade](#10-output-cascade)
- [11. The state machine](#11-the-state-machine)
- [12. Failure modes](#12-failure-modes)
- [13. Quick reference card](#13-quick-reference-card)

---

## 1. The whole picture

How [agent-run.yml](../workflows/agent-run.yml) plugs into everything.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        c1["cron 0 9 * * 1,4\n(tester)"]:::trig
        c2["cron 0 10 * * 2,5\n(docs)"]:::trig
        c3["cron 0 11 * * 1\n(scout)"]:::trig
        d1["workflow_dispatch\ninputs: agent + instructions"]:::trig
    end

    subgraph A["agent-run.yml"]
        G["gate job\nbacklog cap check"]:::gate
        R["run-agent job\ntimeout 30m"]:::job
    end

    subgraph S["Secrets and Identity"]
        s1["APP_ID + APP_PRIVATE_KEY"]:::file
        s2["CLAUDE_CODE_OAUTH_TOKEN"]:::file
        bot["llm-exe-bot[bot]\nshort-lived token"]:::file
    end

    subgraph F["Files read/written"]
        cfg["scripts/agents/config.sh"]:::file
        pr["scripts/agents/prompts/&lt;agent&gt;.md"]:::file
        lg["scripts/agents/logs/&lt;agent&gt;/*.md\n(prior runs read, new run written)"]:::file
        tmp["/tmp/agent-prompt.txt\n(assembled prompt)"]:::file
    end

    subgraph X["External"]
        gh["GitHub API\n(issues, PRs, comments)"]:::ext
        ant["Anthropic Claude\nvars.ANTHROPIC_OPUS_LATEST\n(default: claude-opus-4-6)"]:::ext
        web["Provider docs sites\n(scout only)"]:::ext
    end

    subgraph O["Outputs"]
        b["branch agent/&lt;role&gt;/&lt;date&gt;"]:::out
        prnew["PR to development\n(docs/tester)"]:::out
        iss["GitHub issues\n(scout, or out-of-scope bug)"]:::out
        log["committed log file\n(reads itself on future runs)"]:::out
    end

    subgraph D["Downstream workflows"]
        rev["agent-review-pr.yml\nfires on opened agent/* PR"]:::job
        tst["tests.yml\nfires on PR open/sync"]:::job
        dig["agent-digest.yml\nreads logs Monday"]:::job
        cdr["coder-run.yml\nmay pick up issues filed here"]:::job
    end

    c1 --> G
    c2 --> G
    c3 --> G
    d1 --> G
    G -->|proceed=true| R
    G -.->|proceed=false on cron when backlog over cap| skip(["skip"])
    s1 --> bot
    bot --> R
    s2 --> R
    R --> cfg
    cfg --> pr
    cfg --> lg
    pr --> tmp
    lg --> tmp
    tmp --> ant
    R --> gh
    R --> web
    R --> b
    R --> log
    R --> prnew
    R --> iss
    prnew --> rev
    prnew --> tst
    log --> dig
    iss --> cdr
```

[Back to top](#navigate)

---

## 2. Triggers and what each one does

Four entry points. Each routes to a different agent and behavior.

```mermaid
flowchart TB
    classDef cron fill:#0e7490,color:#fff,stroke:#000
    classDef manual fill:#9333ea,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|schedule| sch{which cron string?}
    ev -->|workflow_dispatch| disp[use inputs.agent verbatim]:::manual

    sch -->|0 9 * * 1,4| tA[agent=tester]:::cron
    sch -->|0 10 * * 2,5| dA[agent=docs]:::cron
    sch -->|0 11 * * 1| sA[agent=scout]:::cron
    sch -->|anything else| fail([no agent set, prompt fails])

    disp -.gate skipped.-> proceed[(run with chosen agent)]:::out
    tA --> gateChk
    dA --> gateChk
    sA --> gateChk
    gateChk{bot PRs &lt;= 20\nopen issues &lt;= 40?}
    gateChk -->|yes| proceed
    gateChk -->|no| stop([skip with warning])
```

Source: [.github/workflows/agent-run.yml](../workflows/agent-run.yml) lines 19-23 (cron map), 102-110 (cron-to-agent dispatch), 46-66 (gate).

[Back to top](#navigate)

---

## 3. Inputs and how they shape the run

Two dispatch inputs. Two derived inputs. Each one changes one specific thing.

```mermaid
flowchart LR
    classDef inp fill:#7c2d12,color:#fff,stroke:#000
    classDef use fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    subgraph Inputs
        I1["inputs.agent\n(choice: docs|tester|coder|scout)"]:::inp
        I2["inputs.instructions\n(free text, optional)"]:::inp
        I3["github.event.schedule\n(set on cron)"]:::inp
        I4["github.event_name\n(schedule vs workflow_dispatch)"]:::inp
    end

    subgraph Effects
        E1["picks prompt file\nscripts/agents/prompts/&lt;agent&gt;.md"]:::use
        E2["names branch and log\nagent/&lt;agent&gt;/&lt;date&gt;"]:::use
        E3["sets concurrency group\nagent-&lt;agent or schedule&gt;"]:::use
        E4["maps cron to agent\n(only if event_name=schedule)"]:::use
        E5["appends Additional Instructions\nblock to assembled prompt"]:::use
        E6["bypasses backlog gate\n(only if event_name=workflow_dispatch)"]:::use
    end

    subgraph Outputs
        O1["Claude's behavior\n(which scope, which steps)"]:::out
        O2["where files live\n(deterministic paths)"]:::out
        O3["whether two runs can collide\n(no: keyed by agent identity)"]:::out
        O4["redirects scheduled work\n(only knob a maintainer has)"]:::out
        O5["allows over-cap runs\n(escape hatch)"]:::out
    end

    I1 --> E1 --> O1
    I1 --> E2 --> O2
    I1 --> E3 --> O3
    I3 --> E4 --> E1
    I4 --> E6 --> O5
    I2 --> E5 --> O4
```

[Back to top](#navigate)

---

## 4. The two-job DAG

Job graph with timeouts and gating.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000

    start([Workflow event])
    start --> J1

    subgraph J1["Job: gate (ubuntu-latest)"]
        direction TB
        g1["Generate bot token"]:::step
        g2["Backlog gate check"]:::gate
        g1 --> g2
    end

    J1 -->|outputs.proceed| dec{proceed == 'true'?}
    dec -->|no| stop([end])
    dec -->|yes| J2

    subgraph J2["Job: run-agent (ubuntu-latest, timeout-minutes: 30)"]
        direction TB
        r1["Generate bot token"]:::step
        r2["Checkout fetch-depth: 0\nwith bot token"]:::step
        r3["Configure git\nuser.name = llm-exe-bot[bot]"]:::step
        r4["actions/setup-node@v4\nnode-version: 20, cache: npm"]:::step
        r5["npm ci"]:::step
        r6["Pick agent for scheduled runs\n(only if event_name=schedule)"]:::step
        r7["Build prompt step\n(branch, log, prompt assembly)"]:::step
        r8["Run agent step\nanthropics/claude-code-action@v1"]:::step
        r9["Clock out (if: always())"]:::step
        r1 --> r2 --> r3 --> r4 --> r5 --> r6 --> r7 --> r8 --> r9
    end
```

Concurrency group is `agent-${{ github.event.inputs.agent || github.event.schedule }}` with `cancel-in-progress: false`. Two runs of the same agent queue; two different agents run in parallel.

[Back to top](#navigate)

---

## 5. Step-by-step lifecycle

One run from event to clock-out, with every file touched.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event
    participant J as run-agent job
    participant T as Token mint
    participant G as Git
    participant N as Node + npm
    participant C as config.sh
    participant P as prompts/(agent).md
    participant L as logs/(agent)/
    participant TMP as /tmp/agent-prompt.txt
    participant CCA as claude-code-action@v1
    participant API as Anthropic + GitHub

    E->>J: dispatch / schedule
    J->>T: create-github-app-token@v1 (APP_ID, APP_PRIVATE_KEY)
    T-->>J: bot token (short-lived)
    J->>G: checkout fetch-depth 0 with bot token
    J->>G: git config llm-exe-bot[bot]
    J->>N: setup-node@v4 + npm ci
    Note over J: if event_name=schedule, map cron to agent
    J->>C: source scripts/agents/config.sh
    C->>G: create_agent_branch (checkout development, pull, checkout -b)
    G-->>C: branch name on stdout
    C->>L: clock_in writes skeleton .md
    L-->>C: log file path
    C->>P: sed -e 's|$BRANCH|...|g' -e 's|$LOG_FILE|...|g'
    P-->>C: rendered template
    C->>L: build_prior_context (cat last 3 logs, skip current)
    L-->>C: prior text
    C->>TMP: write template + prior + Time Budget + maintainer instructions
    J->>CCA: run prompt = "Read /tmp/agent-prompt.txt"
    CCA->>API: streaming inference (vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6)
    API-->>CCA: tool calls (Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch)
    CCA->>G: git add/commit/push origin (branch)
    CCA->>API: gh pr create / gh issue create
    CCA->>L: rewrite Summary, Files Changed, Next Steps
    J->>C: clock_out (always) maps job.status to exit code
    C->>L: stamp Finished UTC + Status completed|interrupted
```

Source: [.github/workflows/agent-run.yml](../workflows/agent-run.yml) lines 74-171.

[Back to top](#navigate)

---

## 6. Anatomy of the prompt

Four layers concatenated into `/tmp/agent-prompt.txt`. This is what Claude actually reads.

```mermaid
flowchart TB
    classDef l1 fill:#0e7490,color:#fff,stroke:#000
    classDef l2 fill:#155e75,color:#fff,stroke:#000
    classDef l3 fill:#7c2d12,color:#fff,stroke:#000
    classDef l4 fill:#581c87,color:#fff,stroke:#000

    A["LAYER 1: Role template\nscripts/agents/prompts/&lt;agent&gt;.md\nwith $BRANCH and $LOG_FILE substituted"]:::l1
    B["LAYER 2: Prior runs\nconcatenated contents of last 3 log files\nunder ## Prior Runs header\n(skips current run)"]:::l2
    C["LAYER 3: Time Budget\nstart UTC + deadline UTC + 600s\ntells agent to run date -u +%H:%M to pace itself"]:::l3
    D["LAYER 4: Maintainer Instructions\n(only present on workflow_dispatch with inputs.instructions)\nAppended under ## Additional Instructions from Maintainer"]:::l4

    A --> X[("write /tmp/agent-prompt.txt")]
    B --> X
    C --> X
    D --> X
    X --> R[("Claude reads it as its only prompt")]
```

Each layer answers one question:

| Layer | Question it answers |
|-------|---------------------|
| 1. Role template | "Who am I, what's in scope, what are the steps?" |
| 2. Prior runs | "What did I do last time, what's still pending?" |
| 3. Time Budget | "How long do I have?" |
| 4. Maintainer notes | "Anything special this run?" |

[Back to top](#navigate)

---

## 7. Filesystem reads and writes

Color: blue is read, orange is write, purple is both. Why each one exists.

```mermaid
flowchart LR
    classDef read fill:#1e3a8a,color:#fff,stroke:#000
    classDef write fill:#9a3412,color:#fff,stroke:#000
    classDef both fill:#581c87,color:#fff,stroke:#000
    classDef tmp fill:#374151,color:#fff,stroke:#000

    subgraph reads["READ"]
        r1["CLAUDE.md\nproject context, philosophy, known issues"]:::read
        r2["scripts/agents/config.sh\nshared bash helpers"]:::read
        r3["scripts/agents/prompts/&lt;agent&gt;.md\nthe role template with substitution markers"]:::read
        r4["scripts/agents/prompts/_persona.md\n(personas only, host template)"]:::read
        r5["scripts/agents/prompts/personas/&lt;name&gt;.md\n(personas only, personality)"]:::read
        r6["src/, docs/, examples/, README.md\nwork surfaces depending on agent scope"]:::read
        r7["package.json\nversion for milestone decisions"]:::read
    end

    subgraph writes["WRITE"]
        w1["agent/&lt;role&gt;/&lt;date&gt;\na fresh git branch"]:::write
        w2["src/ or docs/ or *.test.ts\nfiles within agent's scope only"]:::write
        w3["/tmp/agent-prompt.txt\nthe assembled prompt (ephemeral, runner-local)"]:::write
        w4["GitHub PR\ngh pr create --base development"]:::write
        w5["GitHub issues\ngh issue create (scout only; others on out-of-scope bug)"]:::write
        w6["GitHub comments\nplan comments before coding (coder), dedup comments (scout, curator)"]:::write
    end

    subgraph both["READ + WRITE"]
        b1["scripts/agents/logs/&lt;role&gt;/*.md\nprior runs read at start, new run written at end"]:::both
    end

    r2 --> b1
    r3 --> w3
    b1 --> w3
    r1 --> w3
    r6 --> w2
    r1 --> w4
    r6 --> w5
    r7 --> w5
```

Why logs are committed: see [WORKFLOW_ARCHITECTURE.md Appendix C item 3](WORKFLOW_ARCHITECTURE.md). They are the only durable cross-run memory.

[Back to top](#navigate)

---

## 8. External calls

Who is contacted, with what credential, why.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef llm fill:#581c87,color:#fff,stroke:#000
    classDef gh fill:#1f2937,color:#fff,stroke:#000
    classDef web fill:#064e3b,color:#fff,stroke:#000

    subgraph Pre["Before the agent starts"]
        c1["actions/create-github-app-token@v1\nauth: APP_ID + APP_PRIVATE_KEY\nwhy: bot identity so writes trigger downstream"]:::pre
        c2["actions/checkout@v4\nauth: bot token\nwhy: fetch full history (depth 0) for git operations"]:::pre
        c3["actions/setup-node@v4\nauth: none\nwhy: install Node 20, prime npm cache"]:::pre
    end

    subgraph During["While the agent runs"]
        d1["api.anthropic.com\nauth: CLAUDE_CODE_OAUTH_TOKEN\nwhy: model inference (vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6)\ncost meter: --max-turns 50"]:::llm
        d2["api.github.com (gh CLI)\nauth: bot token\nwhy: create PR, file issue, comment, list/view"]:::gh
        d3["origin remote (git push)\nauth: bot token\nwhy: push agent/&lt;role&gt;/&lt;date&gt; branch"]:::gh
        d4["provider docs sites\nauth: anonymous\nused by: scout only\nURLs: hard-coded in scout.md"]:::web
    end

    c1 --> c2
    c2 --> c3
    c3 --> d1
    d1 --> d2
    d1 --> d3
    d1 --> d4
```

Tool allowlist passed to `claude-code-action@v1`:

```
--allowedTools "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"
--max-turns 50
--model ${{ vars.ANTHROPIC_OPUS_LATEST || 'claude-opus-4-6' }}
```

The action enforces the allowlist. Anything not listed cannot be called.

[Back to top](#navigate)

---

## 9. Per-agent path differences

One workflow, four agents, four paths.

```mermaid
flowchart LR
    classDef common fill:#1e3a8a,color:#fff,stroke:#000
    classDef docs fill:#0e7490,color:#fff,stroke:#000
    classDef test fill:#7c2d12,color:#fff,stroke:#000
    classDef code fill:#581c87,color:#fff,stroke:#000
    classDef scout fill:#064e3b,color:#fff,stroke:#000

    A["agent-run.yml entry"]:::common
    A --> B{which agent?}

    B -->|docs| D1["scope: docs/, *.md, examples/"]:::docs
    D1 --> D2["read src/index.ts to enumerate exports"]:::docs
    D2 --> D3["update docs to current API"]:::docs
    D3 --> D4["typecheck examples"]:::docs
    D4 --> D5["PR title: docs: update documentation to match current API"]:::docs

    B -->|tester| T1["scope: *.test.ts and utils/"]:::test
    T1 --> T2["npm test, read coverage output"]:::test
    T2 --> T3["pick high-value modules with low coverage"]:::test
    T3 --> T4["write tests using mock helpers"]:::test
    T4 --> T5["PR title: test: improve test coverage"]:::test

    B -->|coder| C1["scope: src/**/*.ts + co-located tests"]:::code
    C1 --> C2["find open bug/enhancement issue (or agent-ok)"]:::code
    C2 --> C3["post plan comment on issue first"]:::code
    C3 --> C4["implement + test + typecheck + lint"]:::code
    C4 --> C5["PR title: fix: ... body: Fixes #N"]:::code

    B -->|scout| S1["scope: zero code, only research"]:::scout
    S1 --> S2["read src/llm/ to know current shorthands"]:::scout
    S2 --> S3["fetch provider docs via WebFetch"]:::scout
    S3 --> S4["dedup via /tmp/all-issues.json + gh search"]:::scout
    S4 --> S5["gh issue create or comment on existing"]:::scout

    D5 --> Z[("common: clock_out updates log file")]:::common
    T5 --> Z
    C5 --> Z
    S5 --> Z
```

Why coder is scheduled separately in [coder-run.yml](../workflows/coder-run.yml) instead of here: the coder needs a matrix over multiple issues; this workflow is single-job. See [WORKFLOW_ARCHITECTURE.md section 9.2](WORKFLOW_ARCHITECTURE.md).

[Back to top](#navigate)

---

## 10. Output cascade

What this workflow produces and who eats it.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    AR["agent-run.yml\nrun completes"]:::src

    AR --> O1["branch agent/&lt;role&gt;/&lt;date&gt;\npushed to origin"]:::out
    AR --> O2["PR to development\n(docs, tester)"]:::out
    AR --> O3["GitHub issues\n(scout always; others on out-of-scope finding)"]:::out
    AR --> O4["log file committed at\nscripts/agents/logs/&lt;role&gt;/&lt;ts&gt;.md"]:::out

    O2 --> C1["agent-review-pr.yml\nfires on opened agent/* PR"]:::cons
    O2 --> C2["tests.yml\nfires on PR open/sync (Node 18,20,22,24)"]:::cons
    O2 --> C3["update-prs-with-development.yml\nrebases this PR weekday mornings"]:::cons

    O3 --> C4["coder-run.yml find-issues\npicks unclaimed bug/enhancement/agent-ok"]:::cons
    O3 --> C5["maintainer triage"]:::human

    O4 --> C6["next agent-run for the same role\nreads it as Prior Runs"]:::cons
    O4 --> C7["agent-digest.yml\nweekly summary of agent activity"]:::cons

    C1 --> H1{verdict}:::cons
    H1 -->|approve| C5
    H1 -->|request changes| AR
    H1 -.close.-> X[("noise pruned")]

    C5 --> M["maintainer merges PR\nto development"]:::human
    M --> D1["draft-main-pr.yml\nupdates dev->main draft PR"]:::cons
    M --> D2["pack-package.yml\nuploads .tgz artifact"]:::cons
```

Why `agent-review-pr.yml` only fires for branches starting with `agent/`: see job-level `if: startsWith(github.head_ref, 'agent/')` in [agent-review-pr.yml](../workflows/agent-review-pr.yml) line 16.

Why the digest can read logs that came from this workflow: logs are committed to git, not stored as artifacts. They survive past the 90-day artifact retention.

[Back to top](#navigate)

---

## 11. The state machine

A single run as a finite state machine.

```mermaid
stateDiagram-v2
    [*] --> Queued: event arrives
    Queued --> GateChecking: runner picks up gate job
    GateChecking --> Skipped: cron + backlog over cap
    GateChecking --> Ready: dispatch OR within caps
    Ready --> Booting: run-agent job starts
    Booting --> Setup: checkout + node + npm ci
    Setup --> PromptBuilt: config.sh creates branch, log, prompt file
    PromptBuilt --> Running: claude-code-action started
    Running --> Working: tool calls (Bash, Read, Write, Edit...)
    Working --> Working: loop until done or limit
    Working --> PRCreated: gh pr create succeeded
    Working --> IssueCreated: gh issue create succeeded
    Working --> NoOutput: no changes worth a PR (legitimate)
    PRCreated --> Logging: write Summary / Files Changed / Next Steps
    IssueCreated --> Logging
    NoOutput --> Logging
    Logging --> ClockOut: status mapped to exit code
    ClockOut --> Completed: exit 0
    ClockOut --> Interrupted: any non-zero
    Working --> TimedOut: 30-minute job timeout OR max-turns 50
    TimedOut --> ClockOut
    Skipped --> [*]
    Completed --> [*]
    Interrupted --> [*]
```

`if: always()` on the clock-out step means even `TimedOut` and `Interrupted` paths stamp a finish time and update status. The log file is never left in `running` state.

[Back to top](#navigate)

---

## 12. Failure modes

Where things break, what happens, what to do.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["Backlog over cap\n(cron path only)"]:::fail
    F1 --> F1E["gate sets proceed=false\nrun-agent skipped"]:::effect
    F1E --> F1X["maintainer drains queue\nor uses dispatch to bypass"]:::fix

    F2["Bot token mint fails\nAPP_ID or APP_PRIVATE_KEY wrong"]:::fail
    F2 --> F2E["job fails at token step\nno log file written"]:::effect
    F2X["rotate App key, re-add secret"]:::fix
    F2E --> F2X

    F3["npm ci fails"]:::fail
    F3 --> F3E["job fails before agent starts"]:::effect
    F3X["check package-lock alignment"]:::fix
    F3E --> F3X

    F4["Claude action hits --max-turns 50"]:::fail
    F4 --> F4E["agent returns whatever it has\nmay be partial PR"]:::effect
    F4X["reviewer agent will request changes\nor maintainer closes; next run retries"]:::fix
    F4E --> F4X

    F5["Job exceeds 30-minute timeout"]:::fail
    F5 --> F5E["runner kills the step\nclock_out still runs (if: always())\nstatus=interrupted in log"]:::effect
    F5X["next run reads interrupted log under Prior Runs\nresumes work"]:::fix
    F5E --> F5X

    F6["Agent goes out of scope\n(e.g. docs touches src/)"]:::fail
    F6 --> F6E["PR opens but fails review\nagent-review-pr.yml --request-changes or close"]:::effect
    F6X["prompt enforces scope at top\nreviewer enforces at bottom"]:::fix
    F6E --> F6X

    F7["No issues to fix\n(coder)"]:::fail
    F7 --> F7E["find-issues job emits count=0\nrun-coder matrix skipped"]:::effect
    F7X["expected behavior, not a failure"]:::fix
    F7E --> F7X

    F8["Anthropic API outage"]:::fail
    F8 --> F8E["claude-code-action returns error\nclock_out marks interrupted"]:::effect
    F8X["wait, manual dispatch later\nor next cron picks up"]:::fix
    F8E --> F8X

    F9["Two cron runs of same agent overlap"]:::fail
    F9 --> F9E["concurrency group agent-&lt;name&gt; queues second\ncancel-in-progress: false"]:::effect
    F9X["intentional: serialize same agent"]:::fix
    F9E --> F9X
```

[Back to top](#navigate)

---

## 13. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/agent-run.yml"]:::v
    K2["Triggers"]:::k --- V2["3 crons + workflow_dispatch"]:::v
    K3["Inputs"]:::k --- V3["agent (choice), instructions (string)"]:::v
    K4["Permissions"]:::k --- V4["contents/PR/issues: write, id-token: write"]:::v
    K5["Timeout"]:::k --- V5["30 minutes"]:::v
    K6["Concurrency"]:::k --- V6["agent-&lt;agent or schedule&gt;, no cancel"]:::v
    K7["Identity"]:::k --- V7["llm-exe-bot[bot] via App token"]:::v
    K8["Model"]:::k --- V8["vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6"]:::v
    K9["Max turns"]:::k --- V9["50"]:::v
    K10["Tool allowlist"]:::k --- V10["Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch"]:::v
    K11["Gate caps"]:::k --- V11["bot PRs <= 20, open issues <= 40"]:::v
    K12["Branch"]:::k --- V12["agent/&lt;role&gt;/&lt;YYYY-MM-DD&gt;"]:::v
    K13["Log path"]:::k --- V13["scripts/agents/logs/&lt;role&gt;/&lt;ts&gt;.md"]:::v
    K14["Prompt file"]:::k --- V14["scripts/agents/prompts/&lt;agent&gt;.md"]:::v
    K15["Assembled prompt"]:::k --- V15["/tmp/agent-prompt.txt"]:::v
    K16["Base branch for PRs"]:::k --- V16["development"]:::v
```

Direct links:

- Workflow file: [.github/workflows/agent-run.yml](../workflows/agent-run.yml)
- Companion workflows: [coder-run.yml](../workflows/coder-run.yml), [personas-run.yml](../workflows/personas-run.yml), [agent-review-pr.yml](../workflows/agent-review-pr.yml)
- Shared helpers: [scripts/agents/config.sh](../../scripts/agents/config.sh)
- Prompts: [docs.md](../../scripts/agents/prompts/docs.md), [tester.md](../../scripts/agents/prompts/tester.md), [coder.md](../../scripts/agents/prompts/coder.md), [scout.md](../../scripts/agents/prompts/scout.md)
- Local runner: [scripts/maintain.sh](../../scripts/maintain.sh)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)

[Back to top](#navigate)
