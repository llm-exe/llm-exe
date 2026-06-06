# personas-run: Visual Deep Dive

Concentrated diagrams for [.github/workflows/personas-run.yml](../workflows/personas-run.yml) and the curator pipeline it feeds. Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers and what each one does](#2-triggers-and-what-each-one-does)
- [3. Inputs (count choice)](#3-inputs-count-choice)
- [4. The four-job DAG](#4-the-four-job-dag)
- [5. Step-by-step lifecycle](#5-step-by-step-lifecycle)
- [6. The persona-to-curator pipeline](#6-the-persona-to-curator-pipeline)
- [7. Filesystem reads and writes](#7-filesystem-reads-and-writes)
- [8. External calls](#8-external-calls)
- [9. Output cascade](#9-output-cascade)
- [10. State machine](#10-state-machine)
- [11. Failure modes](#11-failure-modes)
- [12. Quick reference card](#12-quick-reference-card)

---

## 1. The whole picture

How [personas-run.yml](../workflows/personas-run.yml) plugs into everything.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        c1["cron 0 6 * * 0\n(Sunday 12am CT)\ncount defaults to 4"]:::trig
        d1["workflow_dispatch\ninput: count (1..4, default 2)"]:::trig
    end

    subgraph A["personas-run.yml"]
        G["gate job\nbacklog cap check"]:::gate
        P["pick-personas job\nshuf + head -n + jq"]:::gate
        R["run-persona matrix\nmax-parallel: 1\ntimeout 20m each"]:::job
        K["run-curator job\nif: always() and != cancelled\ntimeout 20m"]:::job
    end

    subgraph S["Secrets and Identity"]
        s1["APP_ID + APP_PRIVATE_KEY"]:::file
        s2["CLAUDE_CODE_OAUTH_TOKEN"]:::file
        bot["llm-exe-bot[bot]\nshort-lived token per job"]:::file
    end

    subgraph F["Files read/written"]
        cfg["scripts/agents/config.sh"]:::file
        host["scripts/agents/prompts/_persona.md\n(host template)"]:::file
        per["scripts/agents/prompts/personas/&lt;name&gt;.md\n(personality block)"]:::file
        cur["scripts/agents/prompts/curator.md"]:::file
        plog["scripts/agents/logs/personas/&lt;name&gt;/*.md\n(written by each persona)"]:::file
        clog["scripts/agents/logs/curator/*.md\n(curator decisions)"]:::file
        tmp["/tmp/agent-prompt.txt\n(per-job assembled prompt)"]:::file
        ji["/tmp/all-issues.json\n(curator scratch)"]:::file
    end

    subgraph X["External"]
        gh["GitHub API (gh CLI)\nissues, comments, search"]:::ext
        ant["Anthropic Claude\nvars.ANTHROPIC_OPUS_LATEST\n(default: claude-opus-4-6)"]:::ext
    end

    subgraph O["Outputs"]
        b1["branch agent/&lt;persona&gt;/&lt;date&gt;\n(one per persona run)"]:::out
        b2["branch agent/curator/&lt;date&gt;"]:::out
        iss["GitHub issues\n(curator only, deduped)"]:::out
        cmt["comments on existing issues\n(curator when dup found)"]:::out
        log["committed log files\n(both personas and curator)"]:::out
    end

    subgraph D["Downstream workflows"]
        cdr["coder-run.yml\nfinds bug/enhancement/agent-ok\nissues filed by curator"]:::job
        dig["agent-digest.yml\nreads logs Monday"]:::job
    end

    c1 --> G
    d1 --> G
    G -->|proceed=true| P
    G -.->|proceed=false on cron when backlog over cap| skip(["skip"])
    P --> R
    R --> K
    s1 --> bot
    bot --> R
    bot --> K
    s2 --> R
    s2 --> K
    cfg --> R
    cfg --> K
    host --> R
    per --> R
    cur --> K
    R --> plog
    plog --> K
    K --> clog
    K --> ji
    R --> tmp
    K --> tmp
    tmp --> ant
    K --> gh
    R --> b1
    K --> b2
    K --> iss
    K --> cmt
    iss --> cdr
    plog --> dig
    clog --> dig
```

[Back to top](#navigate)

---

## 2. Triggers and what each one does

Two entry points. Both run the same DAG. The only knob is `count`.

```mermaid
flowchart TB
    classDef cron fill:#0e7490,color:#fff,stroke:#000
    classDef manual fill:#9333ea,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|schedule| sch[cron string 0 6 * * 0]:::cron
    ev -->|workflow_dispatch| disp[use inputs.count verbatim]:::manual

    sch --> def["count = inputs.count or '4'\n(no input on cron, falls back to 4)"]:::cron
    disp --> dc["count from choice input\ndefault 2 in the dispatch UI"]:::manual

    def --> gateChk
    dc -.gate bypassed.-> proceed[(pick-personas runs)]:::out
    gateChk{bot PRs &lt;= 20\nopen issues &lt;= 40?}
    gateChk -->|yes| proceed
    gateChk -->|no| stop([skip with warning])
```

Source: [.github/workflows/personas-run.yml](../workflows/personas-run.yml) lines 3-16 (triggers), 41-56 (gate), 65-70 (pick).

[Back to top](#navigate)

---

## 3. Inputs (count choice)

One input. One derived effect. The matrix size is everything.

```mermaid
flowchart LR
    classDef inp fill:#7c2d12,color:#fff,stroke:#000
    classDef use fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    subgraph Inputs
        I1["inputs.count\n(choice: 1 | 2 | 3 | 4)\ndefault on dispatch: 2"]:::inp
        I2["github.event_name\n(schedule vs workflow_dispatch)"]:::inp
    end

    subgraph Pick["pick-personas job"]
        P1["printf beginner harsh-critic\nspeed-runner enterprise"]:::use
        P2["shuf (randomize order)"]:::use
        P3["head -n $count"]:::use
        P4["jq -R . | jq -sc .\n(to JSON array)"]:::use
        P1 --> P2 --> P3 --> P4
    end

    subgraph Effects
        E1["matrix.persona = JSON array\nof selected persona names"]:::use
        E2["matrix size = count\nmax-parallel: 1 enforces serial"]:::use
        E3["wall clock = count * up to 20m\n(plus curator 20m)"]:::use
        E4["bypasses backlog gate\n(only if event_name=workflow_dispatch)"]:::use
    end

    subgraph Outputs
        O1["how many personas run this session"]:::out
        O2["total job count: 2 + count + 1\n(gate + pick + N + curator)"]:::out
        O3["session wall clock\nworst case 4 * 20m + 20m = 1h40m"]:::out
        O4["allows over-cap runs (escape hatch)"]:::out
    end

    I1 --> P3
    P4 --> E1 --> O1
    E1 --> E2 --> O2
    E2 --> E3 --> O3
    I2 --> E4 --> O4
```

Default behavior: on dispatch the UI shows count=2; on the Sunday cron the input is absent so the `|| '4'` fallback fires and all four personas run before the curator.

[Back to top](#navigate)

---

## 4. The four-job DAG

Job graph with dependencies, conditions, and timeouts.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef mat fill:#581c87,color:#fff,stroke:#000

    start([Workflow event])
    start --> J1

    subgraph J1["Job: gate (ubuntu-latest)"]
        direction TB
        g1["Generate bot token"]:::step
        g2["Backlog gate check\n(dispatch bypasses)"]:::gate
        g1 --> g2
    end

    J1 -->|outputs.proceed| dec1{proceed == 'true'?}
    dec1 -->|no| stop([end])
    dec1 -->|yes| J2

    subgraph J2["Job: pick-personas (ubuntu-latest)"]
        direction TB
        p1["shuf 4 names"]:::step
        p2["head -n count"]:::step
        p3["jq to JSON array"]:::step
        p1 --> p2 --> p3
    end

    J2 -->|outputs.personas| J3

    subgraph J3["Job: run-persona (matrix, max-parallel: 1, timeout 20m)"]
        direction TB
        m1["matrix.persona[0]\n(full job chain)"]:::mat
        m2["matrix.persona[1]"]:::mat
        m3["matrix.persona[N]"]:::mat
        m1 -.serial.-> m2
        m2 -.serial.-> m3
    end

    J3 --> dec2{run-persona.result?}
    dec2 -->|cancelled| stop2([skip curator])
    dec2 -->|success / failure / skipped| J4

    subgraph J4["Job: run-curator (ubuntu-latest, timeout 20m)"]
        direction TB
        c1["Generate bot token"]:::step
        c2["Checkout fetch-depth: 0"]:::step
        c3["Configure git"]:::step
        c4["setup-node@v4 + npm ci"]:::step
        c5["Build curator prompt"]:::step
        c6["Run curator\nclaude-code-action@v1"]:::step
        c7["Clock out (if: always())"]:::step
        c1 --> c2 --> c3 --> c4 --> c5 --> c6 --> c7
    end
```

Key conditions:

| Job | `if` expression | Effect |
|-----|-----------------|--------|
| pick-personas | `needs.gate.outputs.proceed == 'true'` | Skip when gated |
| run-persona | `needs.gate.outputs.proceed == 'true'` | Skip when gated |
| run-curator | `always() && needs.gate.outputs.proceed == 'true' && needs.run-persona.result != 'cancelled'` | Run even when some personas fail; only skip if the whole matrix was cancelled |

The curator running on partial persona failures is intentional: one persona timing out should not throw away the others' findings.

[Back to top](#navigate)

---

## 5. Step-by-step lifecycle

One full session from event to curator clock-out. Each matrix slot reruns steps 3-9 in sequence (max-parallel: 1).

```mermaid
sequenceDiagram
    autonumber
    participant E as Event
    participant GT as gate job
    participant PK as pick-personas job
    participant RP as run-persona matrix
    participant CR as run-curator job
    participant T as Token mint
    participant C as config.sh
    participant FS as filesystem (logs, prompts)
    participant CCA as claude-code-action@v1
    participant API as Anthropic + GitHub

    E->>GT: dispatch / cron 0 6 * * 0
    GT->>T: mint bot token
    GT->>API: gh pr list + gh issue list (cron only)
    GT-->>PK: proceed=true
    PK->>PK: shuf | head -n count | jq
    PK-->>RP: personas JSON array

    loop for each persona in matrix (serial)
        RP->>T: mint bot token (fresh per slot)
        RP->>FS: checkout fetch-depth 0
        RP->>C: source config.sh
        C->>FS: create_agent_branch agent/(persona)/(date)
        C->>FS: clock_in writes skeleton log under logs/personas/(name)/
        RP->>FS: read _persona.md (host)
        RP->>FS: read personas/(name).md (block)
        RP->>FS: sed sub LOG_FILE then bash sub PERSONA
        RP->>FS: append Time Budget, write /tmp/agent-prompt.txt
        RP->>CCA: prompt = Read /tmp/agent-prompt.txt
        CCA->>API: streaming inference (vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6)
        API-->>CCA: tool calls (Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch)
        Note over CCA: persona writes findings to its log file ONLY (no PRs, no issues)
        RP->>C: clock_out (always) stamps status
    end

    RP-->>CR: matrix complete (any non-cancelled result)
    CR->>T: mint bot token
    CR->>FS: checkout fetch-depth 0
    CR->>C: source config.sh
    C->>FS: create_agent_branch agent/curator/(date)
    C->>FS: clock_in writes skeleton log under logs/curator/
    CR->>FS: sed sub BRANCH + LOG_FILE into curator.md
    CR->>FS: append Time Budget, write /tmp/agent-prompt.txt
    CR->>CCA: prompt = Read /tmp/agent-prompt.txt
    CCA->>FS: read all logs/personas/*/*.md
    CCA->>API: gh issue list --state all > /tmp/all-issues.json
    CCA->>API: gh search issues per finding (dedup)
    CCA->>API: gh issue create OR gh issue comment
    CCA->>FS: rewrite curator log Summary, Files Changed, Next Steps
    CR->>C: clock_out (always)
```

Source: [.github/workflows/personas-run.yml](../workflows/personas-run.yml) lines 72-155 (run-persona), 157-229 (run-curator).

[Back to top](#navigate)

---

## 6. The persona-to-curator pipeline

The whole point of this workflow: personas observe and log, curator promotes and dedups.

```mermaid
flowchart TB
    classDef persona fill:#0e7490,color:#fff,stroke:#000
    classDef log fill:#7c2d12,color:#fff,stroke:#000
    classDef cur fill:#581c87,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    subgraph Hosts["Prompt assembly per persona"]
        H1["_persona.md (host)\ncontains literal \$PERSONA marker"]:::persona
        H2["personas/(name).md\npersonality block"]:::persona
        H1 -- "bash \${prompt/\$PERSONA/...}" --> H3["assembled host\nwith block injected"]:::persona
        H2 --> H3
        H3 -- "sed \$LOG_FILE -> path" --> H4["/tmp/agent-prompt.txt"]:::persona
    end

    subgraph Run["Persona run (4 variants)"]
        R1["beginner\nliteral docs reader"]:::persona
        R2["harsh-critic\nsenior engineer review"]:::persona
        R3["speed-runner\nno docs, types-driven"]:::persona
        R4["enterprise\nproduction edge cases"]:::persona
    end

    H4 --> R1
    H4 --> R2
    H4 --> R3
    H4 --> R4

    subgraph Logs["Per-persona logs (committed to git)"]
        L1["logs/personas/beginner/(ts).md"]:::log
        L2["logs/personas/harsh-critic/(ts).md"]:::log
        L3["logs/personas/speed-runner/(ts).md"]:::log
        L4["logs/personas/enterprise/(ts).md"]:::log
    end

    R1 --> L1
    R2 --> L2
    R3 --> L3
    R4 --> L4

    subgraph Curator["Curator job"]
        C1["read all logs/personas/*/*.md"]:::cur
        C2["read CLAUDE.md Known Issues"]:::cur
        C3["gh issue list --state all\n> /tmp/all-issues.json"]:::cur
        C4{"per finding:\nPROMOTE or SKIP?"}:::cur
        C5["dedup: 2-3 distinctive terms,\njq local + gh search remote"]:::cur
        C6{"any existing issue\nmatches root behavior?"}:::cur
        C1 --> C4
        C2 --> C4
        C3 --> C5
        C4 -->|PROMOTE| C5
        C5 --> C6
    end

    L1 --> C1
    L2 --> C1
    L3 --> C1
    L4 --> C1

    C6 -->|no match| O1["gh issue create\nlabel: bug | documentation | enhancement | testing\ncombine if multiple personas hit same thing"]:::out
    C6 -->|match found| O2["gh issue comment <N>\nPersona X hit this again on YYYY-MM-DD"]:::out
    C4 -->|SKIP| O3["log SKIP reason\nin curator log"]:::out
```

Finding fields each persona must write per item (from [_persona.md](../../scripts/agents/prompts/_persona.md)):

| Field | Required content |
|-------|------------------|
| What you tried | Specific action |
| What happened | Actual result |
| What you expected | Only if different from actual |
| Severity | genuine-bug, confusing, rough-edge, or suggestion |
| File/line | If applicable |

Curator's bar for PROMOTE (from [curator.md](../../scripts/agents/prompts/curator.md)): "Would a maintainer thank me for this issue, or roll their eyes?"

[Back to top](#navigate)

---

## 7. Filesystem reads and writes

Color: blue is read, orange is write, purple is both.

```mermaid
flowchart LR
    classDef read fill:#1e3a8a,color:#fff,stroke:#000
    classDef write fill:#9a3412,color:#fff,stroke:#000
    classDef both fill:#581c87,color:#fff,stroke:#000

    subgraph reads["READ"]
        r1["CLAUDE.md\nphilosophy + Known Issues (skipped by personas, dedup-checked by curator)"]:::read
        r2["README.md, docs/, examples/\n(personas exercise the library)"]:::read
        r3["scripts/agents/config.sh\nshared bash helpers"]:::read
        r4["scripts/agents/prompts/_persona.md\nhost template with \$PERSONA + \$LOG_FILE markers"]:::read
        r5["scripts/agents/prompts/personas/(name).md\npersonality block"]:::read
        r6["scripts/agents/prompts/curator.md\ncurator instructions"]:::read
        r7["src/, src/llm/, src/parser/\n(personas only read to use API)"]:::read
    end

    subgraph writes["WRITE"]
        w1["agent/(persona)/(date) and agent/curator/(date)\nfresh git branches"]:::write
        w2["/tmp/agent-prompt.txt\nephemeral, per job"]:::write
        w3["/tmp/all-issues.json\ncurator scratch for dedup"]:::write
        w4["GitHub issues\ncurator only, deduped"]:::write
        w5["GitHub issue comments\ncurator only, when dup found"]:::write
    end

    subgraph both["READ + WRITE"]
        b1["scripts/agents/logs/personas/(name)/*.md\nwritten by persona, read by curator + next runs"]:::both
        b2["scripts/agents/logs/curator/*.md\nwritten by curator, read by future curator runs (via Prior Runs convention)"]:::both
    end

    r3 --> b1
    r3 --> b2
    r4 --> w2
    r5 --> w2
    r6 --> w2
    r1 --> w4
    r2 --> b1
    r7 --> b1
    b1 --> w4
    b1 --> w5
    r1 --> w5
```

Critical: personas do not touch `src/` for writes. They read source to use the library, then write findings only to their log file. The host template at [_persona.md](../../scripts/agents/prompts/_persona.md) line 28 enforces this: "Do not file GitHub issues. Do not create PRs. Do not modify source code."

[Back to top](#navigate)

---

## 8. External calls

Who is contacted, with what credential, why.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef llm fill:#581c87,color:#fff,stroke:#000
    classDef gh fill:#1f2937,color:#fff,stroke:#000

    subgraph Pre["Each job startup (gate, pick, every matrix slot, curator)"]
        c1["actions/create-github-app-token@v1\nauth: APP_ID + APP_PRIVATE_KEY\nwhy: short-lived bot token per job"]:::pre
        c2["actions/checkout@v4\nauth: bot token\nfetch-depth: 0 (full history for branch ops)"]:::pre
        c3["actions/setup-node@v4\nnode-version: 20, cache: npm"]:::pre
    end

    subgraph During["While the LLM runs (persona OR curator)"]
        d1["api.anthropic.com\nauth: CLAUDE_CODE_OAUTH_TOKEN\nwhy: model inference (vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6)\ncost meter: --max-turns 40"]:::llm
        d2["api.github.com (gh CLI)\nauth: bot token\nused by: curator only\ncalls: gh issue list, gh search issues, gh issue create, gh issue comment"]:::gh
        d3["origin remote (git push)\nauth: bot token\nused by: both (branch push for log commits)"]:::gh
    end

    c1 --> c2
    c2 --> c3
    c3 --> d1
    d1 --> d2
    d1 --> d3
```

Tool allowlist passed to `claude-code-action@v1` (identical for persona and curator):

```
--allowedTools "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"
--max-turns 40
--model ${{ vars.ANTHROPIC_OPUS_LATEST || 'claude-opus-4-6' }}
```

Note the lower `--max-turns 40` here vs `50` in [agent-run.yml](../workflows/agent-run.yml): personas and curator do less coordination work per session than the docs/tester/scout agents.

[Back to top](#navigate)

---

## 9. Output cascade

What this workflow produces and who eats it.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    PR["personas-run.yml\nsession completes"]:::src

    PR --> O1["per-persona log files\nlogs/personas/(name)/(ts).md"]:::out
    PR --> O2["curator log file\nlogs/curator/(ts).md"]:::out
    PR --> O3["GitHub issues created\n(by curator, deduped)"]:::out
    PR --> O4["comments on existing issues\n(when curator dedupes)"]:::out

    O3 --> C1["coder-run.yml find-issues\npicks unclaimed bug / enhancement / agent-ok"]:::cons
    O3 --> C2["maintainer triage\nlabels, milestones"]:::human

    O1 --> C3["next persona run for same name\n(if convention adds Prior Runs later)"]:::cons
    O1 --> C4["next curator run\nre-reads all persona logs"]:::cons
    O2 --> C5["agent-digest.yml\nMonday summary of agent activity"]:::cons

    C1 --> C6["coder opens PR to development"]:::cons
    C6 --> C7["agent-review-pr.yml\nfires on agent/* PR"]:::cons
    C6 --> C8["tests.yml\nfires on PR open/sync"]:::cons
    C2 --> M["maintainer merges to development"]:::human
```

Why personas do not file issues directly: every persona is a biased observer by design (the beginner over-reports, the harsh-critic over-criticizes). The curator is the single quality gate that turns four biased streams into one signal stream. See [curator.md](../../scripts/agents/prompts/curator.md) section "Your bar for PROMOTE".

Why curator log lives separately from persona logs: the digest workflow can count personas-vs-curator activity independently, and the curator's dedup decisions are auditable from one place.

[Back to top](#navigate)

---

## 10. State machine

A single session as a finite state machine. Note the curator path runs even on partial persona failure.

```mermaid
stateDiagram-v2
    [*] --> Queued: event arrives
    Queued --> GateChecking: gate job picked up
    GateChecking --> Skipped: cron + backlog over cap
    GateChecking --> Picking: proceed=true
    Picking --> MatrixReady: shuf + head + jq emits JSON array
    MatrixReady --> PersonaRunning: matrix slot N starts
    PersonaRunning --> PersonaWorking: claude-code-action started
    PersonaWorking --> PersonaWorking: tool calls within scope (read-only on src)
    PersonaWorking --> PersonaLogged: writes findings to its log
    PersonaWorking --> PersonaTimedOut: 20m job timeout OR --max-turns 40
    PersonaTimedOut --> PersonaLogged: clock_out always() stamps interrupted
    PersonaLogged --> NextSlot: more personas in matrix?
    NextSlot --> PersonaRunning: yes (max-parallel: 1, serial)
    NextSlot --> CuratorGate: matrix complete
    CuratorGate --> CuratorSkipped: matrix.result == cancelled
    CuratorGate --> CuratorRunning: success / failure / skipped
    CuratorRunning --> CuratorReading: pull all persona logs
    CuratorReading --> CuratorDeduping: gh issue list + gh search per finding
    CuratorDeduping --> CuratorFiling: PROMOTE + no dup
    CuratorDeduping --> CuratorCommenting: PROMOTE + dup found
    CuratorDeduping --> CuratorSkipping: SKIP
    CuratorFiling --> CuratorLogged
    CuratorCommenting --> CuratorLogged
    CuratorSkipping --> CuratorLogged
    CuratorLogged --> ClockOut: status mapped to exit code
    ClockOut --> Completed: exit 0
    ClockOut --> Interrupted: any non-zero
    Skipped --> [*]
    CuratorSkipped --> [*]
    Completed --> [*]
    Interrupted --> [*]
```

`if: always()` on every clock-out step means even interrupted personas and an interrupted curator stamp a finish time. No log file is ever left in `running`.

[Back to top](#navigate)

---

## 11. Failure modes

Where things break, what happens, what to do.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["Backlog over cap (cron only)"]:::fail
    F1 --> F1E["gate sets proceed=false\nall downstream jobs skip"]:::effect
    F1E --> F1X["drain queue OR dispatch manually (bypasses gate)"]:::fix

    F2["pick-personas shuf empty (impossible, but guarded)"]:::fail
    F2 --> F2E["matrix would be empty\nrun-persona job effectively skipped"]:::effect
    F2X["printf list is hard-coded with 4 names, will not fail"]:::fix
    F2E --> F2X

    F3["One persona hits 20m timeout"]:::fail
    F3 --> F3E["that slot marked interrupted\nclock_out stamps log\nnext slot still runs (max-parallel: 1, but failure does not cancel)"]:::effect
    F3X["curator still reads partial log\ntreat as one less finding source"]:::fix
    F3E --> F3X

    F4["All personas fail"]:::fail
    F4 --> F4E["run-persona.result = failure\ncurator still runs (always() + != cancelled)"]:::effect
    F4X["curator reads logs/personas/*/*.md anyway\nemits empty session log"]:::fix
    F4E --> F4X

    F5["Matrix cancelled by user / GH"]:::fail
    F5 --> F5E["run-persona.result = cancelled\ncurator skipped (the only path that skips it)"]:::effect
    F5X["no harm done; next cron picks up next Sunday"]:::fix
    F5E --> F5X

    F6["Persona files an issue anyway (against host rules)"]:::fail
    F6 --> F6E["unwanted issue lands on backlog"]:::effect
    F6X["host prompt at _persona.md line 4 + line 28 forbids\nclose issue, log violation"]:::fix
    F6E --> F6X

    F7["Curator skips dedup procedure"]:::fail
    F7 --> F7E["duplicate issues filed"]:::effect
    F7X["curator.md step 5 is auditable: log queries\nmaintainer reviews log if dup slips"]:::fix
    F7E --> F7X

    F8["Anthropic API outage mid-session"]:::fail
    F8 --> F8E["affected job returns error\nclock_out marks interrupted\nremaining jobs still attempt"]:::effect
    F8X["next cron retries; manual dispatch available"]:::fix
    F8E --> F8X

    F9["Two sessions overlap"]:::fail
    F9 --> F9E["no concurrency group declared at workflow level\nGitHub runs both\nbranch names collide on same date"]:::effect
    F9X["create_agent_branch fails on second run (branch exists)\nfirst session wins, second's clock_in still writes a new ts-named log"]:::fix
    F9E --> F9X
```

Unlike [agent-run.yml](../workflows/agent-run.yml), this workflow declares no `concurrency:` group. Overlapping runs are theoretically possible (manual dispatch during cron). The same-day branch collision in `create_agent_branch` is the de facto guard.

[Back to top](#navigate)

---

## 12. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/personas-run.yml"]:::v
    K2["Triggers"]:::k --- V2["cron 0 6 * * 0 + workflow_dispatch"]:::v
    K3["Inputs"]:::k --- V3["count (choice 1..4, dispatch default 2)"]:::v
    K4["Cron count fallback"]:::k --- V4["4 (the || '4' in pick-personas)"]:::v
    K5["Jobs"]:::k --- V5["gate, pick-personas, run-persona (matrix), run-curator"]:::v
    K6["Permissions"]:::k --- V6["contents/PR/issues: write, id-token: write"]:::v
    K7["Per-job timeout"]:::k --- V7["20 minutes (persona + curator)"]:::v
    K8["Matrix parallelism"]:::k --- V8["max-parallel: 1 (strictly serial)"]:::v
    K9["Curator condition"]:::k --- V9["always() && proceed && != cancelled"]:::v
    K10["Identity"]:::k --- V10["llm-exe-bot[bot] via App token"]:::v
    K11["Model"]:::k --- V11["vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6"]:::v
    K12["Max turns"]:::k --- V12["40"]:::v
    K13["Tool allowlist"]:::k --- V13["Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch"]:::v
    K14["Gate caps"]:::k --- V14["bot PRs &lt;= 20, open issues &lt;= 40"]:::v
    K15["Persona branches"]:::k --- V15["agent/&lt;persona&gt;/&lt;YYYY-MM-DD&gt;"]:::v
    K16["Curator branch"]:::k --- V16["agent/curator/&lt;YYYY-MM-DD&gt;"]:::v
    K17["Persona logs"]:::k --- V17["scripts/agents/logs/personas/&lt;name&gt;/&lt;ts&gt;.md"]:::v
    K18["Curator log"]:::k --- V18["scripts/agents/logs/curator/&lt;ts&gt;.md"]:::v
    K19["Host template"]:::k --- V19["scripts/agents/prompts/_persona.md"]:::v
    K20["Persona blocks"]:::k --- V20["beginner, harsh-critic, speed-runner, enterprise"]:::v
    K21["Curator prompt"]:::k --- V21["scripts/agents/prompts/curator.md"]:::v
    K22["Curator dedup scratch"]:::k --- V22["/tmp/all-issues.json"]:::v
    K23["Persona writes"]:::k --- V23["log file ONLY (no PRs, no issues)"]:::v
    K24["Curator writes"]:::k --- V24["GitHub issues + comments + log file"]:::v
```

Direct links:

- Workflow file: [.github/workflows/personas-run.yml](../workflows/personas-run.yml)
- Companion workflows: [agent-run.yml](../workflows/agent-run.yml), [coder-run.yml](../workflows/coder-run.yml), [agent-review-pr.yml](../workflows/agent-review-pr.yml)
- Shared helpers: [scripts/agents/config.sh](../../scripts/agents/config.sh)
- Host template: [scripts/agents/prompts/_persona.md](../../scripts/agents/prompts/_persona.md)
- Persona blocks: [beginner.md](../../scripts/agents/prompts/personas/beginner.md), [harsh-critic.md](../../scripts/agents/prompts/personas/harsh-critic.md), [speed-runner.md](../../scripts/agents/prompts/personas/speed-runner.md), [enterprise.md](../../scripts/agents/prompts/personas/enterprise.md)
- Curator prompt: [scripts/agents/prompts/curator.md](../../scripts/agents/prompts/curator.md)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)

[Back to top](#navigate)
