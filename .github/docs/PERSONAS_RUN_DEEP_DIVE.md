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
        s1["APP_CLIENT_ID + APP_PRIVATE_KEY"]:::file
        s2["CLAUDE_CODE_OAUTH_TOKEN"]:::file
        bot["llm-exe-bot[bot]\nshort-lived token per job"]:::file
    end

    subgraph F["Files read/written"]
        cfg["scripts/agents/config.sh"]:::file
        host["scripts/agents/prompts/_persona.md\n(host template)"]:::file
        per["scripts/agents/prompts/personas/&lt;name&gt;.md\n(personality block)"]:::file
        cur["scripts/agents/prompts/curator.md"]:::file
        plog["scripts/agents/logs/&lt;name&gt;/*.md\n(written by each persona in its runner,\nnever committed; local runs use logs/personas/, #841)"]:::file
        art["artifact persona-log-&lt;persona&gt;-&lt;run_id&gt;\n(staged as &lt;persona&gt;/&lt;file&gt;.md, 7-day retention)"]:::file
        pdl["/tmp/persona-logs/&lt;persona&gt;/*.md\n(curator's only findings input)"]:::file
        clog["scripts/agents/logs/curator/*.md\n(curator decisions)"]:::file
        tmp["/tmp/agent-prompt.txt\n(per-job assembled prompt)"]:::file
        ji["/tmp/all-issues.json\n(curator scratch)"]:::file
    end

    subgraph X["External"]
        gh["GitHub API (gh CLI)\nissues, comments, search"]:::ext
        ant["Anthropic Claude\nvars.ANTHROPIC_OPUS_LATEST\n(default: claude-opus-4-6)"]:::ext
    end

    subgraph O["Outputs"]
        b1["branch agent/&lt;persona&gt;/&lt;date&gt;\n(local to the runner, never pushed)"]:::out
        b2["branch agent/curator/&lt;date&gt;\n(local unless the curator pushes it itself, as in #494)"]:::out
        iss["GitHub issues\n(curator only, deduped)"]:::out
        cmt["comments on existing issues\n(curator when dup found)"]:::out
        log["no committed logs\n(persona logs leave only as artifacts;\nno step commits or uploads the curator log)"]:::out
    end

    subgraph D["Downstream workflows"]
        cdr["coder-run.yml\nfinds bug/enhancement/agent-ok\nissues filed by curator"]:::job
        dig["agent-digest.yml\nreads committed logs Monday,\nso it sees nothing from this workflow"]:::job
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
    plog --> art
    art --> pdl
    pdl --> K
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
        c4["setup-node@v6 + npm ci"]:::step
        c5["Download persona findings logs\npattern persona-log-*-&lt;run_id&gt;\nmerge-multiple, continue-on-error"]:::step
        c6["Build curator prompt\ncount_persona_logs + render_curator_prompt"]:::step
        c7["Run curator\nclaude-code-action@v1"]:::step
        c8["Upload agent prompt artifact\n(if: always() and log_file set)"]:::step
        c9["Clock out (if: always())"]:::step
        c1 --> c2 --> c3 --> c4 --> c5 --> c6 --> c7 --> c8 --> c9
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
        C->>FS: clock_in writes skeleton log under logs/(name)/
        RP->>FS: read _persona.md (host)
        RP->>FS: read personas/(name).md (block)
        RP->>FS: sed sub LOG_FILE then bash sub PERSONA
        RP->>FS: append Time Budget, write /tmp/agent-prompt.txt
        RP->>CCA: prompt = Read /tmp/agent-prompt.txt
        CCA->>API: streaming inference (vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6)
        API-->>CCA: tool calls (Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch)
        Note over CCA: persona writes findings to its log file ONLY (no PRs, no issues)
        RP->>FS: upload-artifact@v7 /tmp/agent-prompt.txt (always, 7-day retention)
        RP->>C: clock_out (always) stamps status
        RP->>C: stage_persona_log /tmp/persona-log-upload (persona)/(file).md
        RP->>FS: upload-artifact@v7 persona-log-(persona)-(run_id) (7-day retention)
    end

    RP-->>CR: matrix complete (any non-cancelled result)
    CR->>T: mint bot token
    CR->>FS: checkout fetch-depth 0
    CR->>FS: download-artifact@v7 persona-log-*-(run_id) to /tmp/persona-logs (merge-multiple)
    CR->>C: source config.sh
    C->>FS: create_agent_branch agent/curator/(date)
    C->>FS: clock_in writes skeleton log under logs/curator/
    CR->>C: count_persona_logs then render_curator_prompt (BRANCH, LOG_FILE, PERSONA_LOGS, PERSONA_LOG_COUNT)
    CR->>FS: append Time Budget, write /tmp/agent-prompt.txt
    CR->>CCA: prompt = Read /tmp/agent-prompt.txt
    CCA->>FS: read only /tmp/persona-logs/(persona)/*.md
    CCA->>API: gh issue list --state all > /tmp/all-issues.json
    CCA->>API: gh search issues per finding (dedup)
    CCA->>API: gh issue create OR gh issue comment
    CCA->>FS: rewrite curator log Summary, Files Changed, Next Steps
    CR->>FS: upload-artifact@v7 /tmp/agent-prompt.txt (always, 7-day retention)
    CR->>C: clock_out (always)
```

Source: [.github/workflows/personas-run.yml](../workflows/personas-run.yml) lines 72-185 (run-persona), 187-289 (run-curator).

The artifact hop is the whole handoff: a findings log lives in the runner's checkout and is never committed, so without the upload it dies with the job. Staging it as `(persona)/(file).md` before upload means `merge-multiple: true` on the download puts every persona's log straight under `/tmp/persona-logs` with its persona name intact, at any persona count. Without `merge-multiple`, `download-artifact` only adds a per-artifact directory when two or more artifacts match, so the layout the curator prompt describes would change with `count`.

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

    subgraph Logs["Per-persona logs (runner checkout, never committed)"]
        L1["logs/beginner/(ts).md"]:::log
        L2["logs/harsh-critic/(ts).md"]:::log
        L3["logs/speed-runner/(ts).md"]:::log
        L4["logs/enterprise/(ts).md"]:::log
    end

    R1 --> L1
    R2 --> L2
    R3 --> L3
    R4 --> L4

    subgraph Hop["Artifact handoff (one per persona)"]
        A1["stage_persona_log\n/tmp/persona-log-upload/(persona)/(file).md"]:::log
        A2["artifact persona-log-(persona)-(run_id)"]:::log
        A3["download-artifact merge-multiple\n/tmp/persona-logs/(persona)/(file).md"]:::log
        A1 --> A2 --> A3
    end

    L1 --> A1
    L2 --> A1
    L3 --> A1
    L4 --> A1

    subgraph Curator["Curator job"]
        C1["read only /tmp/persona-logs/(persona)/*.md\n(this run's logs, never the repo's)"]:::cur
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

    A3 --> C1

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

Step 1 of that prompt names `$PERSONA_LOGS` and `$PERSONA_LOG_COUNT`, both filled in by `render_curator_prompt` in [config.sh](../../scripts/agents/config.sh), and it explicitly forbids reading `scripts/agents/logs/personas/` in the repo: those are historical logs whose findings already have issues, and re-reading them is the duplicate-filing bug this handoff exists to prevent.

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
        w2b["/tmp/persona-log-upload/(persona)/(file).md\nstage_persona_log output, uploaded as an artifact"]:::write
        w2c["/tmp/persona-logs/(persona)/(file).md\ncurator's download target, its only findings input"]:::write
        w3["/tmp/all-issues.json\ncurator scratch for dedup"]:::write
        w4["GitHub issues\ncurator only, deduped"]:::write
        w5["GitHub issue comments\ncurator only, when dup found"]:::write
    end

    subgraph both["READ + WRITE"]
        b1["scripts/agents/logs/(name)/*.md\nwritten by persona, reaches the curator only as an artifact copy"]:::both
        b2["scripts/agents/logs/curator/*.md\nwritten by curator in its runner; not committed or uploaded,\nand this workflow passes no Prior Runs context"]:::both
    end

    r3 --> b1
    r3 --> b2
    r4 --> w2
    r5 --> w2
    r6 --> w2
    r1 --> w4
    r2 --> b1
    r7 --> b1
    b1 --> w2b
    w2b --> w2c
    w2c --> w4
    w2c --> w5
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
        c1["actions/create-github-app-token@v3\nauth: APP_CLIENT_ID + APP_PRIVATE_KEY\nwhy: short-lived bot token per job"]:::pre
        c2["actions/checkout@v6\nauth: bot token\nfetch-depth: 0 (full history for branch ops)"]:::pre
        c3["actions/setup-node@v6\nnode-version: 24, cache: npm"]:::pre
    end

    subgraph During["While the LLM runs (persona OR curator)"]
        d1["api.anthropic.com\nauth: CLAUDE_CODE_OAUTH_TOKEN\nwhy: model inference (vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6)\ncost meter: --max-turns 80"]:::llm
        d2["api.github.com (gh CLI)\nauth: bot token\nused by: curator only\ncalls: gh issue list, gh search issues, gh issue create, gh issue comment"]:::gh
        d3["origin remote\nauth: bot token\nused by: both, git pull in create_agent_branch\nno step pushes; the token can, and the curator did once (#494)"]:::gh
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
--max-turns 80
--model ${{ vars.ANTHROPIC_OPUS_LATEST || 'claude-opus-4-6' }}
```

The `--max-turns 80` budget here is higher than the `50` used by [agent-run.yml](../workflows/agent-run.yml) docs/tester/scout agents. Personas exercise the library through many small steps (read, run, observe, write finding) and the curator iterates per-finding through dedup search + create/comment, so the extra headroom keeps them from running out of turns mid-session.

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

    PR --> O1["per-persona log files\nlogs/(name)/(ts).md in each runner,\nkept 7 days as persona-log artifacts"]:::out
    PR --> O2["curator log file\nlogs/curator/(ts).md, runner only"]:::out
    PR --> O3["GitHub issues created\n(by curator, deduped)"]:::out
    PR --> O4["comments on existing issues\n(when curator dedupes)"]:::out

    O3 --> C1["coder-run.yml find-issues\npicks unclaimed bug / enhancement / agent-ok"]:::cons
    O3 --> C2["maintainer triage\nlabels, milestones"]:::human

    O1 --> C4["this run's curator only\n(artifact scoped to github.run_id)"]:::cons

    C1 --> C6["coder opens PR to development"]:::cons
    C6 --> C7["agent-review-pr.yml\nfires on agent/* PR"]:::cons
    C6 --> C8["tests.yml\nfires on PR open/sync"]:::cons
    C2 --> M["maintainer merges to development"]:::human
```

Why personas do not file issues directly: every persona is a biased observer by design (the beginner over-reports, the harsh-critic over-criticizes). The curator is the single quality gate that turns four biased streams into one signal stream. See [curator.md](../../scripts/agents/prompts/curator.md) section "Your bar for PROMOTE".

Why curator log lives separately from persona logs: the curator's dedup decisions are meant to be auditable from one place (curator.md step 5e). Neither log is committed, though, so that audit trail ends with the run, and the weekly digest, which reads only committed logs under `scripts/agents/logs/`, sees neither.

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
    PersonaWorking --> PersonaTimedOut: 20m job timeout OR --max-turns 80
    PersonaTimedOut --> PersonaLogged: clock_out always() stamps interrupted
    PersonaLogged --> NextSlot: more personas in matrix?
    NextSlot --> PersonaRunning: yes (max-parallel: 1, serial)
    NextSlot --> CuratorGate: matrix complete
    CuratorGate --> CuratorSkipped: matrix.result == cancelled
    CuratorGate --> CuratorRunning: success / failure / skipped
    CuratorRunning --> CuratorReading: read /tmp/persona-logs (this run's artifacts only)
    CuratorReading --> CuratorDeduping: gh issue list + gh search per finding
    CuratorDeduping --> CuratorFiling: PROMOTE + no dup
    CuratorDeduping --> CuratorCommenting: PROMOTE + dup found
    CuratorDeduping --> CuratorSkipping: SKIP
    CuratorFiling --> CuratorLogged
    CuratorCommenting --> CuratorLogged
    CuratorSkipping --> CuratorLogged
    CuratorLogged --> ClockOut: status mapped to exit code
    ClockOut --> Completed: exit 0 and log_has_content
    ClockOut --> NoOutput: exit 0 but every section still the placeholder
    ClockOut --> Interrupted: any non-zero
    Skipped --> [*]
    CuratorSkipped --> [*]
    Completed --> [*]
    NoOutput --> [*]
    Interrupted --> [*]
```

`if: always()` on every clock-out step means even interrupted personas and an interrupted curator stamp a finish time. No log file is ever left in `running`.

A clean exit is not the same as a useful run. `clock_out` calls `log_has_content` and stamps `no-output` when a persona or the curator exited 0 but left all three log sections as the `_Pending ..._` placeholder that `clock_in` wrote. In CI that surfaces as a `::warning title=Agent wrote no output::` annotation; `clock_out` still returns 0 so the job stays green, because it is the last command of a `bash -e` step. The local `run_persona` and `run_curator` runners in [scripts/maintain.sh](../../scripts/maintain.sh) re-check `log_has_content` after `clock_out` and print a `warn` line for the same case. This is the check that would have caught the four 2026-03-05 persona stubs, which looked identical to clean runs.

The local curator mirrors the CI handoff rather than reading the repo: `./scripts/maintain.sh curator <log.md>...` stages the logs you name (plus any `run_persona` wrote in this invocation, which is how `all` feeds it) into a `mktemp -d` directory as `(persona)/(file).md`, then calls the same `render_curator_prompt` CI uses, and removes the staging directory after clock-out. Staging happens before the `cd` so relative paths resolve from your shell's directory, and before `create_agent_branch` so a bad path leaves git untouched. With no logs to curate it errors out instead of running.

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
    F4X["curator downloads whatever artifacts exist\n0 logs is a valid no-op (::warning + prompt handles it)"]:::fix
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
    F7X["curator.md step 5e asks the curator to log its queries,\nbut the curator log is not committed or uploaded,\nso after the run there is no log to review"]:::fix
    F7E --> F7X

    F8["Anthropic API outage mid-session"]:::fail
    F8 --> F8E["affected job returns error\nclock_out marks interrupted\nremaining jobs still attempt"]:::effect
    F8X["next cron retries; manual dispatch available"]:::fix
    F8E --> F8X

    F10["Staging fails (log missing, or two logs collide on one target path)"]:::fail
    F10 --> F10E["stage_persona_log returns 1\n::warning Persona log not staged\nupload step finds no files (if-no-files-found: warn)"]:::effect
    F10X["that persona's findings miss this curator run only\nthe log still exists in the runner checkout; rerun the session"]:::fix
    F10E --> F10X

    F11["Download step fails (artifact API hiccup)"]:::fail
    F11 --> F11E["continue-on-error: true, job keeps going\ncount_persona_logs returns 0 on the missing dir"]:::effect
    F11X["curator no-ops with a ::warning; no partial or stale curation"]:::fix
    F11E --> F11X

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
    K12["Max turns"]:::k --- V12["80"]:::v
    K13["Tool allowlist"]:::k --- V13["Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch"]:::v
    K14["Gate caps"]:::k --- V14["bot PRs &lt;= 20, open issues &lt;= 40"]:::v
    K15["Persona branches"]:::k --- V15["agent/&lt;persona&gt;/&lt;YYYY-MM-DD&gt;"]:::v
    K16["Curator branch"]:::k --- V16["agent/curator/&lt;YYYY-MM-DD&gt;"]:::v
    K17["Persona logs"]:::k --- V17["scripts/agents/logs/&lt;name&gt;/&lt;ts&gt;.md (CI, never committed; local: logs/personas/&lt;name&gt;/, #841)"]:::v
    K18["Curator log"]:::k --- V18["scripts/agents/logs/curator/&lt;ts&gt;.md"]:::v
    K19["Host template"]:::k --- V19["scripts/agents/prompts/_persona.md"]:::v
    K20["Persona blocks"]:::k --- V20["beginner, harsh-critic, speed-runner, enterprise"]:::v
    K21["Curator prompt"]:::k --- V21["scripts/agents/prompts/curator.md"]:::v
    K22["Curator dedup scratch"]:::k --- V22["/tmp/all-issues.json"]:::v
    K23["Persona writes"]:::k --- V23["log file ONLY (no PRs, no issues)"]:::v
    K24["Curator writes"]:::k --- V24["GitHub issues + comments + log file"]:::v
    K25["Prompt artifact"]:::k --- V25["upload-artifact@v7, /tmp/agent-prompt.txt, 7-day retention (both jobs)"]:::v
    K26["Findings artifact"]:::k --- V26["persona-log-&lt;persona&gt;-&lt;run_id&gt;, staged &lt;persona&gt;/&lt;file&gt;.md, 7-day retention"]:::v
    K27["Curator input"]:::k --- V27["/tmp/persona-logs (download pattern persona-log-*-&lt;run_id&gt;, merge-multiple)"]:::v
    K28["Shared helpers"]:::k --- V28["stage_persona_log, count_persona_logs, render_curator_prompt"]:::v
    K29["Local curator"]:::k --- V29["./scripts/maintain.sh curator &lt;log.md&gt;... (or via 'all')"]:::v
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
