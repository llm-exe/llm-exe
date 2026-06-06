# coder-run: Visual Deep Dive

Concentrated diagrams for [.github/workflows/coder-run.yml](../workflows/coder-run.yml) and the issue-selection logic that drives it. Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers and what each one does](#2-triggers-and-what-each-one-does)
- [3. The three-job DAG](#3-the-three-job-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. Filesystem reads and writes](#5-filesystem-reads-and-writes)
- [6. External calls](#6-external-calls)
- [7. The issue selection algorithm](#7-the-issue-selection-algorithm)
- [8. Output cascade](#8-output-cascade)
- [9. The state machine](#9-the-state-machine)
- [10. Failure modes](#10-failure-modes)
- [11. How it differs from agent-run.yml](#11-how-it-differs-from-agent-runyml)
- [12. Quick reference card](#12-quick-reference-card)

---

## 1. The whole picture

How [coder-run.yml](../workflows/coder-run.yml) plugs into everything.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        c1["cron 0 8 * * 1,4\n(2am CT Mon/Thu)"]:::trig
        d1["workflow_dispatch\n(no inputs)"]:::trig
    end

    subgraph A["coder-run.yml"]
        G["gate job\nbacklog cap check"]:::gate
        F["find-issues job\njq filter + claimed dedup + cap 5"]:::gate
        R["run-coder job\nmatrix per issue, max-parallel 1\ntimeout 30m"]:::job
    end

    subgraph S["Secrets and Identity"]
        s1["APP_ID + APP_PRIVATE_KEY"]:::file
        s2["CLAUDE_CODE_OAUTH_TOKEN"]:::file
        bot["llm-exe-bot[bot]\nshort-lived token"]:::file
    end

    subgraph FS["Files read/written"]
        cfg["scripts/agents/config.sh"]:::file
        pr["scripts/agents/prompts/coder.md"]:::file
        lg["scripts/agents/logs/coder/*.md"]:::file
        tmp["/tmp/agent-prompt.txt"]:::file
    end

    subgraph X["External"]
        gh["GitHub API\n(issues, PRs, comments)"]:::ext
        ant["Anthropic Claude\nvars.ANTHROPIC_OPUS_LATEST\n(default: claude-opus-4-6)"]:::ext
    end

    subgraph O["Outputs"]
        b["branch agent/coder/(date)-issue-N"]:::out
        prnew["PR to development\nFixes #N"]:::out
        cmt["plan comment on issue #N"]:::out
        log["committed log file per matrix leg"]:::out
    end

    subgraph D["Downstream workflows"]
        rev["agent-review-pr.yml\nfires on opened agent/* PR"]:::job
        tst["tests.yml\nfires on PR open/sync"]:::job
        dig["agent-digest.yml\nreads coder logs Monday"]:::job
    end

    c1 --> G
    d1 --> G
    G -->|proceed=true| F
    G -.->|proceed=false on cron, over cap| skip(["skip"])
    F -->|count != 0| R
    F -.->|count == 0| done(["skip matrix"])
    s1 --> bot
    bot --> G
    bot --> F
    bot --> R
    s2 --> R
    R --> cfg
    cfg --> pr
    cfg --> lg
    pr --> tmp
    lg --> tmp
    tmp --> ant
    R --> gh
    R --> b
    R --> prnew
    R --> cmt
    R --> log
    prnew --> rev
    prnew --> tst
    log --> dig
```

[Back to top](#navigate)

---

## 2. Triggers and what each one does

Two entry points. Both run the same agent (coder), but the gate behaves differently.

```mermaid
flowchart TB
    classDef cron fill:#0e7490,color:#fff,stroke:#000
    classDef manual fill:#9333ea,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|schedule| sch["cron 0 8 * * 1,4\n2am CT Mon/Thu"]:::cron
    ev -->|workflow_dispatch| disp["manual dispatch\nno inputs"]:::manual

    sch --> gateChk
    disp --> bypass["bypass gate\nproceed=true immediately"]:::manual

    gateChk{"bot PRs &lt;= 20\nopen issues &lt;= 40?"}
    gateChk -->|yes| proceed[(continue to find-issues)]:::out
    gateChk -->|no| stop(["skip with warning"])
    bypass --> proceed
```

Source: [.github/workflows/coder-run.yml](../workflows/coder-run.yml) lines 3-7 (triggers), 26-46 (gate logic).

Unlike [agent-run.yml](../workflows/agent-run.yml), there is no `inputs.agent` or `inputs.instructions`. The agent is always `coder` and the work surface is always GitHub issues. No knobs.

[Back to top](#navigate)

---

## 3. The three-job DAG

Job graph with gating, fan-out, and serialization.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef matrix fill:#581c87,color:#fff,stroke:#000

    start([Workflow event])
    start --> J1

    subgraph J1["Job: gate (ubuntu-latest)"]
        direction TB
        g1["Generate bot token"]:::step
        g2["Backlog gate\n(bypassed on dispatch)"]:::gate
        g1 --> g2
    end

    J1 -->|outputs.proceed| dec1{proceed == 'true'?}
    dec1 -->|no| stop1([end])
    dec1 -->|yes| J2

    subgraph J2["Job: find-issues (ubuntu-latest)"]
        direction TB
        f1["Generate bot token"]:::step
        f2["List open issues\njq filter on labels"]:::gate
        f3["Find claimed issues\nscan open bot PRs"]:::gate
        f4["Subtract claimed\ncap to 5"]:::gate
        f1 --> f2 --> f3 --> f4
    end

    J2 -->|outputs.count, outputs.issues| dec2{count != '0'?}
    dec2 -->|no| stop2([end, no matrix legs])
    dec2 -->|yes| J3

    subgraph J3["Job: run-coder (matrix, max-parallel 1, timeout 30m)"]
        direction TB
        m1["leg 1: issue #A"]:::matrix
        m2["leg 2: issue #B"]:::matrix
        m3["leg ...: issue #..."]:::matrix
        m1 --> m2 --> m3
    end

    subgraph LEG["Each matrix leg (sequential)"]
        direction TB
        r1["Generate bot token"]:::step
        r2["Checkout fetch-depth 0"]:::step
        r3["Configure git\nuser.name = llm-exe-bot[bot]"]:::step
        r4["setup-node@v4\nnode 20, cache npm"]:::step
        r5["npm ci"]:::step
        r6["Build prompt step\n(branch, log, prompt assembly,\nAssigned Issue block)"]:::step
        r7["Run coder step\nanthropics/claude-code-action@v1"]:::step
        r8["Clock out (if always())"]:::step
        r1 --> r2 --> r3 --> r4 --> r5 --> r6 --> r7 --> r8
    end

    m1 -.-> LEG
```

`max-parallel: 1` is load-bearing: `create_agent_branch` in [config.sh](../../scripts/agents/config.sh) does `git checkout development; git pull; git checkout -b ...`. Two legs racing on the same runner shape would step on each other's working tree and branch state. Branch creation is not concurrency-safe by design.

There is no top-level `concurrency:` block, so two scheduled or dispatched runs of `coder-run.yml` can overlap. Within one run, the matrix serializes itself.

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

One matrix leg from gate to clock-out. The gate and find-issues jobs run once per workflow; the leg below runs once per selected issue.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event
    participant GT as gate job
    participant FI as find-issues job
    participant J as run-coder leg
    participant TK as Token mint
    participant G as Git
    participant N as Node + npm
    participant C as config.sh
    participant P as prompts/coder.md
    participant L as logs/coder/
    participant TMP as /tmp/agent-prompt.txt
    participant CCA as claude-code-action@v1
    participant API as Anthropic + GitHub

    E->>GT: dispatch or cron
    GT->>TK: create-github-app-token@v1
    TK-->>GT: bot token
    GT->>API: gh pr list (bot author) + gh issue list
    API-->>GT: counts
    Note over GT: dispatch bypasses; cron enforces caps
    GT-->>FI: outputs.proceed=true

    FI->>TK: create-github-app-token@v1
    TK-->>FI: bot token
    FI->>API: gh issue list open --json number,labels
    API-->>FI: issues with labels
    Note over FI: jq filter for bug|enhancement|agent-ok\nminus breaking|needs-discussion|on-hold
    FI->>API: gh pr list open author=bot --json title,body
    API-->>FI: open bot PRs
    Note over FI: grep closes|fixes|resolves #N\nextract claimed issue numbers
    Note over FI: subtract claimed, cap to 5
    FI-->>J: outputs.issues (JSON array), outputs.count

    loop per matrix leg (max-parallel 1)
        J->>TK: create-github-app-token@v1
        TK-->>J: bot token
        J->>G: checkout fetch-depth 0 with bot token
        J->>G: git config llm-exe-bot[bot]
        J->>N: setup-node@v4 + npm ci
        J->>C: source scripts/agents/config.sh
        C->>G: create_agent_branch coder issue-N\n(checkout development, pull, checkout -b)
        G-->>C: agent/coder/(date)-issue-N
        C->>L: clock_in writes skeleton .md
        L-->>C: log file path
        C->>P: sed substitute BRANCH and LOG_FILE
        P-->>C: rendered template
        C->>L: build_prior_context (last 3 coder logs)
        L-->>C: prior text
        C->>TMP: write template + prior + Time Budget + Assigned Issue
        J->>CCA: prompt = "Read /tmp/agent-prompt.txt"
        CCA->>API: streaming inference (vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6)
        API-->>CCA: tool calls
        CCA->>API: gh issue view N (per Assigned Issue block)
        CCA->>API: gh issue comment N (plan)
        CCA->>G: git add/commit/push origin (branch)
        CCA->>API: gh pr create --base development
        CCA->>L: rewrite Summary, Files Changed, Next Steps
        J->>C: clock_out (if always) maps job.status to exit code
        C->>L: stamp Finished UTC + Status
    end
```

Source: [.github/workflows/coder-run.yml](../workflows/coder-run.yml) lines 14-177.

[Back to top](#navigate)

---

## 5. Filesystem reads and writes

Color: blue is read, orange is write, purple is both.

```mermaid
flowchart LR
    classDef read fill:#1e3a8a,color:#fff,stroke:#000
    classDef write fill:#9a3412,color:#fff,stroke:#000
    classDef both fill:#581c87,color:#fff,stroke:#000

    subgraph reads["READ"]
        r1["CLAUDE.md\nproject context, known issues"]:::read
        r2["scripts/agents/config.sh\nshared bash helpers"]:::read
        r3["scripts/agents/prompts/coder.md\nrole template"]:::read
        r4["src/**/*.ts\nsource code to fix"]:::read
        r5["package.json\nversion for milestone decisions"]:::read
        r6["co-located *.test.ts\nexisting test patterns"]:::read
    end

    subgraph writes["WRITE"]
        w1["agent/coder/(date)-issue-N\na fresh git branch per leg"]:::write
        w2["src/**/*.ts edits\nthe fix itself"]:::write
        w3["co-located *.test.ts\ntest for the fix"]:::write
        w4["/tmp/agent-prompt.txt\nassembled prompt (ephemeral)"]:::write
        w5["GitHub PR\ngh pr create --base development\ntitle: fix: ..., body: Fixes #N"]:::write
        w6["GitHub issue comment\nplan posted before coding"]:::write
        w7["new GitHub issue\non out-of-scope finding only"]:::write
    end

    subgraph both["READ + WRITE"]
        b1["scripts/agents/logs/coder/*.md\nprior runs read, new run written"]:::both
    end

    r2 --> b1
    r3 --> w4
    b1 --> w4
    r1 --> w4
    r4 --> w2
    r4 --> w3
    r6 --> w3
    r1 --> w5
    r5 --> w5
```

Prompt layers in `/tmp/agent-prompt.txt` are concatenated in this order:

| Layer | Source | Purpose |
|-------|--------|---------|
| 1. Role template | `scripts/agents/prompts/coder.md` with `$BRANCH` and `$LOG_FILE` substituted | scope, steps, pacing |
| 2. Prior runs | last 3 files under `scripts/agents/logs/coder/*.md` (skips current) | cross-run memory |
| 3. Time Budget | start UTC + deadline UTC (+600s) | self-pacing instruction |
| 4. Assigned Issue | `gh issue view ${{ matrix.issue }}` instruction | locks the leg to one issue |

Layer 4 is unique to this workflow. [agent-run.yml](../workflows/agent-run.yml) has an "Additional Instructions from Maintainer" layer in the same slot; here it is replaced by a hard issue assignment.

[Back to top](#navigate)

---

## 6. External calls

Who is contacted, with what credential, why.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef llm fill:#581c87,color:#fff,stroke:#000
    classDef gh fill:#1f2937,color:#fff,stroke:#000

    subgraph Pre["Before the agent starts (gate + find-issues + leg setup)"]
        c1["create-github-app-token@v1 (x3)\nauth: APP_ID + APP_PRIVATE_KEY\nwhy: each job re-mints (tokens are job-scoped)"]:::pre
        c2["gh pr list / gh issue list (gate)\nauth: bot token\nwhy: backlog caps"]:::pre
        c3["gh issue list --json number,labels (find-issues)\nauth: bot token\nwhy: candidate set"]:::pre
        c4["gh pr list --author app/llm-exe-bot (find-issues)\nauth: bot token\nwhy: claimed detection"]:::pre
        c5["actions/checkout@v4 fetch-depth 0\nauth: bot token\nwhy: full history for branch ops"]:::pre
        c6["actions/setup-node@v4 + npm ci\nauth: none\nwhy: Node 20, prime npm cache"]:::pre
    end

    subgraph During["While the agent runs (per leg)"]
        d1["api.anthropic.com\nauth: CLAUDE_CODE_OAUTH_TOKEN\nwhy: model inference (vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6)\ncost meter: --max-turns 50"]:::llm
        d2["gh issue view N\nauth: bot token\nwhy: read assigned issue"]:::gh
        d3["gh issue comment N (plan)\nauth: bot token\nwhy: visible thinking before code"]:::gh
        d4["gh search issues (dedup)\nauth: bot token\nwhy: out-of-scope findings"]:::gh
        d5["git push origin (branch)\nauth: bot token\nwhy: push agent/coder/(date)-issue-N"]:::gh
        d6["gh pr create --base development\nauth: bot token\nwhy: PR with Fixes #N"]:::gh
    end

    c1 --> c2
    c2 --> c3
    c3 --> c4
    c4 --> c5
    c5 --> c6
    c6 --> d1
    d1 --> d2
    d2 --> d3
    d3 --> d5
    d3 --> d4
    d5 --> d6
```

Tool allowlist passed to `claude-code-action@v1`:

```
--allowedTools "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"
--max-turns 50
--model ${{ vars.ANTHROPIC_OPUS_LATEST || 'claude-opus-4-6' }}
```

WebFetch and WebSearch are allowed but unused for the coder path. They are inherited from the shared tool allowlist convention.

[Back to top](#navigate)

---

## 7. The issue selection algorithm

The find-issues job is the brain of this workflow. It produces the matrix.

```mermaid
flowchart TB
    classDef step fill:#1e3a8a,color:#fff,stroke:#000
    classDef filt fill:#7c2d12,color:#fff,stroke:#000
    classDef set fill:#581c87,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    A["gh issue list --state open --limit 50\n--json number,labels"]:::step
    A --> B["jq: candidate labels\nany name in (bug, enhancement, agent-ok)"]:::filt
    B --> C["jq: skip labels\nNOT any of (breaking, needs-discussion, on-hold)"]:::filt
    C --> D["candidates: array of issue numbers"]:::set

    E["gh pr list --state open --author app/llm-exe-bot\n--limit 100 --json title,body"]:::step
    E --> F["concat title + body per PR\ninto one stream"]:::filt
    F --> G["grep -oiE '(closes|fixes|resolves) #[0-9]+'"]:::filt
    G --> H["grep -oE '[0-9]+'\n(extract bare numbers)"]:::filt
    H --> I["jq -Rn '[inputs | tonumber]'\nbuild JSON array of claimed numbers"]:::set

    D --> J["jq: filter candidates\nwhere number NOT in claimed"]:::filt
    I --> J
    J --> K{"length &gt; 5?"}
    K -->|yes| L["slice .[:5]\ncap to 5 issues"]:::filt
    K -->|no| M["keep as-is"]:::filt
    L --> N["issues: final JSON array"]:::out
    M --> N

    N --> O["set outputs.issues + outputs.count"]:::out
    O --> P["matrix: fromJson(outputs.issues)\nmax-parallel: 1"]:::out
```

Step-by-step trace through the jq pipeline in [.github/workflows/coder-run.yml](../workflows/coder-run.yml) lines 67-90:

| Step | jq fragment | What it does |
|------|-------------|--------------|
| Candidate select | `select((.labels \| map(.name) \| any(. == "bug" or . == "enhancement" or . == "agent-ok")))` | issue must carry at least one allowed label |
| Skip filter | `and (.labels \| map(.name) \| any(. == "breaking" or . == "needs-discussion" or . == "on-hold") \| not)` | issue must not carry any blocking label |
| Project | `\| .number]` | reduce to issue number only |
| Claimed extract (shell) | `grep -oiE '(closes\|fixes\|resolves) #[0-9]+'` then `grep -oE '[0-9]+'` | pull issue refs from open bot PR title and body, case-insensitive |
| Claimed build (jq) | `jq -Rn '[inputs \| tonumber]'` | read whitespace-separated stdin lines into a JSON int array |
| Subtract | `[.[] \| select(. as $n \| $claimed \| index($n) \| not)]` | candidates minus claimed |
| Cap | `if length > 5 then .[:5] else . end` | hard ceiling of 5 matrix legs |

Why this dedup matters: without it, two consecutive Mon/Thu cron runs would both pick the same top issue, the second leg's `create_agent_branch` would race the first PR's branch, and reviewers would see duplicate PRs against `Fixes #N`.

Why the cap is 5: budget control. 5 legs at 30-minute timeout each is 2.5 hours of wall clock with `max-parallel: 1`. Anthropic costs are bounded by `--max-turns 50` per leg.

Edge cases handled:

```mermaid
flowchart LR
    classDef e fill:#7c2d12,color:#fff,stroke:#000
    classDef r fill:#064e3b,color:#fff,stroke:#000

    E1["no open issues match labels"]:::e --> R1["candidates is []"]:::r
    E2["bot PR body has no closes #N"]:::e --> R2["claimed is [], no subtraction"]:::r
    E3["grep finds zero matches"]:::e --> R3["|| true keeps pipeline alive"]:::r
    E4["issue labeled both bug and on-hold"]:::e --> R4["skipped (skip list takes precedence)"]:::r
    E5["fewer than 5 after filter"]:::e --> R5["matrix has length n, no padding"]:::r
    E6["count == 0"]:::e --> R6["run-coder job skipped via if: count != '0'"]:::r
```

[Back to top](#navigate)

---

## 8. Output cascade

What this workflow produces and who eats it.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    CR["coder-run.yml\nmatrix leg completes"]:::src

    CR --> O1["branch agent/coder/(date)-issue-N\npushed to origin"]:::out
    CR --> O2["PR to development\ntitle: fix|feat: ...\nbody: Fixes #N"]:::out
    CR --> O3["plan comment on issue #N\n(before code)"]:::out
    CR --> O4["log file committed at\nscripts/agents/logs/coder/(ts).md"]:::out
    CR --> O5["optional: new issue\nfor out-of-scope finding"]:::out

    O2 --> C1["agent-review-pr.yml\nfires on opened agent/* PR"]:::cons
    O2 --> C2["tests.yml\nfires on PR open/sync (Node 18,20,22,24)"]:::cons
    O2 --> C3["update-prs-with-development.yml\nrebases weekday mornings"]:::cons

    O3 --> C4["maintainer reads plan\ncan steer next run via issue comment"]:::human

    O4 --> C5["next coder-run reads it as Prior Runs\nvia build_prior_context"]:::cons
    O4 --> C6["agent-digest.yml\nweekly Monday summary"]:::cons

    O5 --> C7["next coder-run find-issues\nmay pick it up if labeled bug|enhancement|agent-ok"]:::cons

    C1 --> H1{review verdict}:::cons
    H1 -->|approve| M["maintainer merges PR\nto development"]:::human
    H1 -->|request changes| CR
    H1 -.close.-> X[("noise pruned")]

    M --> D1["draft-main-pr.yml\nupdates dev to main draft PR"]:::cons
    M --> D2["pack-package.yml\nuploads .tgz artifact"]:::cons
```

Closed-loop note: a coder PR that gets merged closes the issue it references. The next run's find-issues job will not see it (state=open filter). A coder PR that gets closed without merge frees the issue for the next run, since the "claimed" check only counts open bot PRs.

[Back to top](#navigate)

---

## 9. The state machine

One matrix leg as a finite state machine. The workflow itself is just gate then find-issues then a fan-out of these.

```mermaid
stateDiagram-v2
    [*] --> Queued: event arrives
    Queued --> GateChecking: runner picks up gate job
    GateChecking --> Skipped: cron + backlog over cap
    GateChecking --> Finding: dispatch OR within caps
    Finding --> NoWork: count == 0 (no candidates or all claimed)
    Finding --> LegsQueued: count between 1 and 5
    LegsQueued --> Booting: next leg picked up (serial)
    Booting --> Setup: checkout + node + npm ci
    Setup --> PromptBuilt: config.sh creates branch, log, prompt
    PromptBuilt --> Running: claude-code-action started
    Running --> Working: tool calls (Bash, Read, Write, Edit...)
    Working --> Working: loop until done or limit
    Working --> Planned: plan comment posted on issue
    Planned --> Coding: implement + test + typecheck + lint
    Coding --> PRCreated: gh pr create succeeded
    Coding --> NoOutput: nothing to commit (legitimate)
    Working --> TimedOut: 30m job timeout OR max-turns 50
    PRCreated --> Logging: write Summary, Files Changed, Next Steps
    NoOutput --> Logging
    TimedOut --> Logging
    Logging --> ClockOut: status mapped to exit code
    ClockOut --> Completed: exit 0
    ClockOut --> Interrupted: any non-zero
    Completed --> LegsQueued: more legs in matrix
    Interrupted --> LegsQueued: max-parallel 1, next leg still runs
    LegsQueued --> [*]: matrix exhausted
    NoWork --> [*]
    Skipped --> [*]
```

`max-parallel: 1` means a leg's failure does not cancel siblings. Each leg has its own branch, log, and prompt. The matrix continues until every issue has had its turn.

`if: always()` on the clock-out step means even `TimedOut` and `Interrupted` legs stamp a finish time and update status. No log is left in `running` state.

[Back to top](#navigate)

---

## 10. Failure modes

Where things break, what happens, what to do.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["Backlog over cap (cron path)"]:::fail
    F1 --> F1E["gate sets proceed=false\nfind-issues and run-coder skipped"]:::effect
    F1E --> F1X["maintainer drains queue\nor uses dispatch to bypass"]:::fix

    F2["No matching issues"]:::fail
    F2 --> F2E["find-issues emits count=0\nrun-coder skipped via if guard"]:::effect
    F2X["expected behavior, not a failure"]:::fix
    F2E --> F2X

    F3["All matching issues already claimed"]:::fail
    F3 --> F3E["candidates non-empty but issues array empty after subtract\ncount=0, matrix skipped"]:::effect
    F3X["wait for review cycle to merge or close existing PRs"]:::fix
    F3E --> F3X

    F4["Bot token mint fails"]:::fail
    F4 --> F4E["one of three jobs fails at token step"]:::effect
    F4X["rotate App key, re-add secret"]:::fix
    F4E --> F4X

    F5["jq filter syntax error"]:::fail
    F5 --> F5E["find-issues step fails\nmatrix never starts"]:::effect
    F5X["test jq locally with cached issue dump"]:::fix
    F5E --> F5X

    F6["grep finds zero closes #N\nin bot PRs"]:::fail
    F6 --> F6E["|| true keeps pipeline alive\nclaimed is []"]:::effect
    F6X["intentional: empty claimed set is valid"]:::fix
    F6E --> F6X

    F7["npm ci fails in a leg"]:::fail
    F7 --> F7E["that leg fails before agent starts\nother legs continue (max-parallel 1, serial)"]:::effect
    F7X["check package-lock alignment on development"]:::fix
    F7E --> F7X

    F8["Claude hits --max-turns 50"]:::fail
    F8 --> F8E["leg returns whatever it has\nmay be partial PR or none"]:::effect
    F8X["reviewer requests changes or maintainer closes;\nnext run sees issue unclaimed and retries"]:::fix
    F8E --> F8X

    F9["Leg exceeds 30-minute timeout"]:::fail
    F9 --> F9E["runner kills step\nclock_out runs (if always())\nstatus=interrupted in log"]:::effect
    F9X["next coder-run reads interrupted log as Prior Runs"]:::fix
    F9E --> F9X

    F10["Agent goes out of scope\n(touches docs/ or examples/)"]:::fail
    F10 --> F10E["PR opens but fails review\nagent-review-pr.yml requests changes or closes"]:::effect
    F10X["prompt enforces scope at top\nreviewer enforces at bottom"]:::fix
    F10E --> F10X

    F11["Two scheduled coder-run instances overlap"]:::fail
    F11 --> F11E["no concurrency group at workflow level\nboth runs may pick same issues if claimed set\nis stale between gate and matrix"]:::effect
    F11X["cron cadence (Mon/Thu 2am CT) makes overlap unlikely;\nclaimed dedup is best-effort, not transactional"]:::fix
    F11E --> F11X

    F12["Anthropic API outage"]:::fail
    F12 --> F12E["claude-code-action returns error\nclock_out marks interrupted"]:::effect
    F12X["wait or dispatch manually later"]:::fix
    F12E --> F12X
```

[Back to top](#navigate)

---

## 11. How it differs from agent-run.yml

Same shared helpers, same tool allowlist, very different shape. The split is intentional.

```mermaid
flowchart LR
    classDef same fill:#1e3a8a,color:#fff,stroke:#000
    classDef ar fill:#0e7490,color:#fff,stroke:#000
    classDef cr fill:#581c87,color:#fff,stroke:#000

    subgraph Shared["Shared between both workflows"]
        s1["scripts/agents/config.sh helpers\ncreate_agent_branch, clock_in, clock_out,\nbuild_prior_context"]:::same
        s2["claude-code-action@v1\nvars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6, --max-turns 50"]:::same
        s3["bot identity via App token"]:::same
        s4["log files committed to git"]:::same
        s5["base branch development"]:::same
        s6["gate caps: bot PRs 20, open issues 40"]:::same
    end

    subgraph AR["agent-run.yml"]
        a1["agents: docs, tester, scout"]:::ar
        a2["3 crons + dispatch with inputs"]:::ar
        a3["inputs.agent and inputs.instructions"]:::ar
        a4["2-job DAG: gate then run-agent"]:::ar
        a5["one run, one agent, one PR"]:::ar
        a6["work surface: docs, tests, research"]:::ar
        a7["concurrency: agent-(name)"]:::ar
        a8["Layer 4 prompt: maintainer instructions"]:::ar
    end

    subgraph CR["coder-run.yml"]
        c1["agent: coder only"]:::cr
        c2["1 cron + dispatch, no inputs"]:::cr
        c3["3-job DAG: gate, find-issues, run-coder matrix"]:::cr
        c4["one run, up to 5 issues, up to 5 PRs"]:::cr
        c5["work surface: src code + tests"]:::cr
        c6["jq-based issue selection"]:::cr
        c7["claimed dedup via bot PR scan"]:::cr
        c8["matrix max-parallel 1\n(branch ops not concurrency-safe)"]:::cr
        c9["no top-level concurrency group"]:::cr
        c10["Layer 4 prompt: Assigned Issue lock"]:::cr
    end
```

Why coder is split out instead of folded into agent-run.yml:

| Concern | agent-run.yml fits | coder-run.yml needed |
|---------|--------------------|----------------------|
| Single work unit per run | docs sweeps a tree, tester writes tests against coverage gaps, scout files issues | each PR closes one issue, not a sweep |
| Fan-out | not needed | matrix over multiple issues per run |
| Work discovery | hard-coded scope in prompt | dynamic issue list from GitHub API |
| Dedup | not applicable | claimed-issue check prevents duplicate PRs |
| Per-leg branch | one branch per run | one branch per matrix leg, named `(date)-issue-N` |

If the coder were squeezed into agent-run.yml, the matrix would either not exist (one issue per run, painfully slow) or duplicate every other agent's job shape (matrix-of-one, awkward).

[Back to top](#navigate)

---

## 12. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/coder-run.yml"]:::v
    K2["Triggers"]:::k --- V2["1 cron (Mon/Thu 2am CT) + workflow_dispatch"]:::v
    K3["Inputs"]:::k --- V3["none"]:::v
    K4["Permissions"]:::k --- V4["contents/PR/issues: write, id-token: write"]:::v
    K5["Jobs"]:::k --- V5["gate, find-issues, run-coder (matrix)"]:::v
    K6["Timeout (per leg)"]:::k --- V6["30 minutes"]:::v
    K7["Concurrency"]:::k --- V7["none at workflow level; matrix has max-parallel 1"]:::v
    K8["Identity"]:::k --- V8["llm-exe-bot[bot] via App token"]:::v
    K9["Model"]:::k --- V9["vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6"]:::v
    K10["Max turns"]:::k --- V10["50"]:::v
    K11["Tool allowlist"]:::k --- V11["Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch"]:::v
    K12["Gate caps"]:::k --- V12["bot PRs <= 20, open issues <= 40 (cron only)"]:::v
    K13["Candidate labels"]:::k --- V13["bug OR enhancement OR agent-ok"]:::v
    K14["Skip labels"]:::k --- V14["breaking OR needs-discussion OR on-hold"]:::v
    K15["Issue cap"]:::k --- V15["5 per run (slice .[:5])"]:::v
    K16["Claimed detection"]:::k --- V16["closes|fixes|resolves #N in open bot PR title/body"]:::v
    K17["Branch"]:::k --- V17["agent/coder/(date)-issue-N"]:::v
    K18["Log path"]:::k --- V18["scripts/agents/logs/coder/(ts).md"]:::v
    K19["Prompt file"]:::k --- V19["scripts/agents/prompts/coder.md"]:::v
    K20["Assembled prompt"]:::k --- V20["/tmp/agent-prompt.txt"]:::v
    K21["Base branch for PRs"]:::k --- V21["development"]:::v
    K22["PR title format"]:::k --- V22["fix: ... or feat: ..."]:::v
    K23["PR body format"]:::k --- V23["Fixes #N + Changes + Testing"]:::v
```

Direct links:

- Workflow file: [.github/workflows/coder-run.yml](../workflows/coder-run.yml)
- Companion workflows: [agent-run.yml](../workflows/agent-run.yml), [personas-run.yml](../workflows/personas-run.yml), [agent-review-pr.yml](../workflows/agent-review-pr.yml)
- Shared helpers: [scripts/agents/config.sh](../../scripts/agents/config.sh)
- Prompt: [coder.md](../../scripts/agents/prompts/coder.md)
- Local runner: [scripts/maintain.sh](../../scripts/maintain.sh)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)
- Sibling deep-dive: [AGENT_RUN_DEEP_DIVE.md](AGENT_RUN_DEEP_DIVE.md)

[Back to top](#navigate)
