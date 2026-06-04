# bot-respond: Visual Deep Dive

Concentrated diagrams for [.github/workflows/bot-respond.yml](../workflows/bot-respond.yml). Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md) and [AGENT_RUN_DEEP_DIVE.md](AGENT_RUN_DEEP_DIVE.md).

This is the interactive surface. A maintainer types `@llm-exe-bot` in a comment, this workflow wakes up, and the bot either answers in line or pushes a commit to the existing PR branch. No new branches. No new PRs.

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers and the three-part filter](#2-triggers-and-the-three-part-filter)
- [3. The one-job DAG](#3-the-one-job-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. The three modes](#5-the-three-modes)
- [6. Anatomy of the inline prompt](#6-anatomy-of-the-inline-prompt)
- [7. Filesystem reads and writes](#7-filesystem-reads-and-writes)
- [8. External calls](#8-external-calls)
- [9. Rules and guardrails](#9-rules-and-guardrails)
- [10. Output cascade](#10-output-cascade)
- [11. State machine](#11-state-machine)
- [12. Failure modes](#12-failure-modes)
- [13. Quick reference card](#13-quick-reference-card)

---

## 1. The whole picture

How [bot-respond.yml](../workflows/bot-respond.yml) plugs into the comment surface.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Trigger"]
        c1["issue_comment\ntypes: [created]\n(issue OR PR comments)"]:::trig
    end

    subgraph G["Three-part filter (job-level if)"]
        f1["contains body '@llm-exe-bot'"]:::gate
        f2["user.login != 'llm-exe-bot[bot]'"]:::gate
        f3["author_association in\nOWNER | MEMBER | COLLABORATOR"]:::gate
    end

    subgraph A["bot-respond.yml"]
        R["respond job\ntimeout 20m, max-turns 50"]:::job
    end

    subgraph S["Secrets and Identity"]
        s1["APP_ID + APP_PRIVATE_KEY"]:::file
        s2["CLAUDE_CODE_OAUTH_TOKEN"]:::file
        bot["llm-exe-bot[bot]\nshort-lived token"]:::file
    end

    subgraph F["Files read"]
        cl["CLAUDE.md\nproject context"]:::file
        src["src/, tests, etc.\nread on demand"]:::file
    end

    subgraph X["External"]
        gh["GitHub API\n(issue/PR diff, view, comment)"]:::ext
        ant["Anthropic Claude\nvars.ANTHROPIC_OPUS_LATEST\n(default: claude-opus-4-6)"]:::ext
    end

    subgraph O["Outputs"]
        cmt["reply comment\non the same issue/PR"]:::out
        commits["commits pushed to\nexisting PR branch (write mode only)"]:::out
    end

    subgraph D["Downstream workflows"]
        tst["tests.yml\nfires on PR sync"]:::job
        rev["agent-review-pr.yml\nfires on agent/* PR sync\nOR dispatched by bot for re-review"]:::job
    end

    c1 --> f1 --> f2 --> f3 --> R
    f1 -.->|miss| skip(["no run"])
    f2 -.->|miss| skip
    f3 -.->|miss| skip
    s1 --> bot
    bot --> R
    s2 --> R
    R --> cl
    R --> src
    R --> ant
    R --> gh
    R --> cmt
    R --> commits
    R -->|"Mode 1: gh workflow run\nagent-review-pr.yml"| rev
    commits --> tst
    commits --> rev
```

[Back to top](#navigate)

---

## 2. Triggers and the three-part filter

One trigger. One AND-gate of three predicates. All three must hold or the job is skipped before any step runs.

```mermaid
flowchart TB
    classDef ev fill:#0e7490,color:#fff,stroke:#000
    classDef chk fill:#7c2d12,color:#fff,stroke:#000
    classDef pass fill:#064e3b,color:#fff,stroke:#000
    classDef drop fill:#1f2937,color:#fff,stroke:#000

    start([issue_comment created])
    start --> ev[event.comment present]:::ev
    ev --> q1{body contains\n'@llm-exe-bot' ?}:::chk
    q1 -->|no| d1([drop: not addressed]):::drop
    q1 -->|yes| q2{user.login !=\n'llm-exe-bot[bot]' ?}:::chk
    q2 -->|no| d2([drop: bot's own comment\nprevents self-loop]):::drop
    q2 -->|yes| q3{author_association in\nOWNER, MEMBER, COLLABORATOR ?}:::chk
    q3 -->|no| d3([drop: untrusted commenter\nblocks trolls and randoms]):::drop
    q3 -->|yes| run([respond job runs]):::pass
```

Source: [.github/workflows/bot-respond.yml](../workflows/bot-respond.yml) lines 14-22.

Why three predicates instead of one:

| Predicate | Defends against |
|-----------|-----------------|
| body contains `@llm-exe-bot` | Random chatter waking the bot |
| user.login != bot itself | Infinite self-reply loops (the bot's own posts trigger the same event) |
| author_association allowlist | Untrusted strangers summoning a write-capable agent |

[Back to top](#navigate)

---

## 3. The one-job DAG

Single linear job. No gate job, no matrix, no fan-out. The three-part filter does all the gating.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000

    start([issue_comment created])
    start --> filt{three-part filter\npasses?}
    filt -->|no| stop([end])
    filt -->|yes| J

    subgraph J["Job: respond (ubuntu-latest, timeout-minutes: 20)"]
        direction TB
        s1["Generate bot token\ncreate-github-app-token@v1"]:::step
        s2["Configure git\nuser.name = llm-exe-bot[bot]\nuser.email = APP_ID+...@users.noreply.github.com"]:::step
        s3["Checkout fetch-depth: 0\nwith bot token"]:::step
        s4["actions/setup-node@v4\nnode-version: 20, cache: npm"]:::step
        s5["npm ci"]:::step
        s6["Respond step\nclaude-code-action@v1\nmax-turns 50, model configurable"]:::step
        s1 --> s2 --> s3 --> s4 --> s5 --> s6
    end
```

No concurrency group declared. Two simultaneous `@llm-exe-bot` mentions in different threads run in parallel. Two in the same thread also run in parallel; the bot relies on each comment carrying its own context.

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

One mention from event to reply. Both modes share the boot; they diverge inside the action.

```mermaid
sequenceDiagram
    autonumber
    participant U as Maintainer
    participant E as Event (issue_comment)
    participant F as Job filter
    participant J as respond job
    participant T as Token mint
    participant G as Git
    participant N as Node + npm
    participant CCA as claude-code-action(v1)
    participant API as Anthropic + GitHub

    U->>E: posts comment with @llm-exe-bot
    E->>F: payload arrives
    Note over F: three-part filter evaluates
    F-->>J: pass: start respond
    J->>T: create-github-app-token(APP_ID, APP_PRIVATE_KEY)
    T-->>J: bot token (short-lived)
    J->>G: git config llm-exe-bot[bot]
    J->>G: checkout fetch-depth 0 with bot token
    J->>N: setup-node@v4 + npm ci
    J->>CCA: run inline prompt + claude_args
    CCA->>API: read CLAUDE.md (Read tool)
    CCA->>API: gh pr view / gh pr diff (Bash tool)
    Note over CCA: decide mode by re-reading the mention
    alt Mode 1: PR review requested
        CCA->>API: gh pr view (number) to get base and head refs
        CCA->>API: gh workflow run agent-review-pr.yml with pr_number, base_ref, head_ref
        CCA->>API: post acknowledgment comment
    else Mode 2: read-only Q and A
        CCA->>API: read source, run npm test if needed
        CCA->>API: post reply comment
    else Mode 3: write
        CCA->>G: gh pr checkout (number)
        CCA->>API: read diff, comments, reviews
        CCA->>G: edit files, npm test, npm run typecheck
        CCA->>G: commit (no Co-Authored-By) and push to PR branch
        CCA->>API: post reply summarizing the change
    end
    API-->>U: notification of bot reply (and PR sync if write)
```

Source: [.github/workflows/bot-respond.yml](../workflows/bot-respond.yml) lines 26-114.

[Back to top](#navigate)

---

## 5. The three modes

The bot decides between three modes based on the verbatim wording of the mention. Ambiguous wording forces a clarification reply.

```mermaid
flowchart TB
    classDef start fill:#0e7490,color:#fff,stroke:#000
    classDef ask fill:#7c2d12,color:#fff,stroke:#000
    classDef disp fill:#155e75,color:#fff,stroke:#000
    classDef ro fill:#1e3a8a,color:#fff,stroke:#000
    classDef wr fill:#581c87,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    A([read the mention]):::start
    A --> Q0{review, re-review,\ntake another look,\ncheck the PR?}:::ask
    Q0 -->|yes, on a PR| D1[Mode 1: DISPATCH REVIEW]:::disp
    Q0 -->|no| Q1{explicit ask to\nfix, revise, address,\nupdate, make changes?}:::ask
    Q1 -->|yes| W1[Mode 3: WRITE]:::wr
    Q1 -->|no| Q2{question, opinion,\nor status?}:::ask
    Q2 -->|yes| R1[Mode 2: READ-ONLY]:::ro
    Q2 -->|ambiguous| C1[reply asking for clarification\nno code touched]:::out

    D1 --> D2["gh pr view (number)\nfetch baseRefName, headRefName"]:::disp
    D2 --> D3["gh workflow run agent-review-pr.yml\n-f pr_number -f base_ref -f head_ref"]:::disp
    D3 --> D4["post acknowledgment comment"]:::out

    R1 --> R2["read source, gh pr view, gh pr diff"]:::ro
    R2 --> R3["run npm test / typecheck if helpful"]:::ro
    R3 --> R4["post concise comment with file:line refs"]:::out

    W1 --> W2["gh pr checkout (number)"]:::wr
    W2 --> W3["gh pr diff + view --comments\n+ /pulls/N/reviews jq body"]:::wr
    W3 --> W4["edit files in scope"]:::wr
    W4 --> W5["npm test AND npm run typecheck\nmust both pass"]:::wr
    W5 --> W6["commit (no Co-Authored-By)\nand push to existing PR branch"]:::wr
    W6 --> W7["post summary comment"]:::out
```

Key invariants: write mode never creates a new branch or a new PR. The bot always pushes to the existing PR branch. If there is no PR branch in context, write mode cannot proceed and the bot must ask for clarification. Review dispatch (Mode 1) delegates to `agent-review-pr.yml` via `gh workflow run` rather than doing an inline review.

[Back to top](#navigate)

---

## 6. Anatomy of the inline prompt

There is no separate prompt file like the maintenance agents have. The full instruction is baked into the workflow yml as `with.prompt`. This makes the contract auditable in one place: change the behavior by editing one file.

```mermaid
flowchart TB
    classDef l1 fill:#0e7490,color:#fff,stroke:#000
    classDef l2 fill:#155e75,color:#fff,stroke:#000
    classDef l3 fill:#7c2d12,color:#fff,stroke:#000
    classDef l4 fill:#581c87,color:#fff,stroke:#000
    classDef l5 fill:#374151,color:#fff,stroke:#000

    A["BLOCK 1: Identity + context\n'You are llm-exe-bot...'\n'Read CLAUDE.md for project context.'"]:::l1
    B["BLOCK 2: Determine what's being asked\nsplits into Mode 1, 2, or 3"]:::l2
    B1["BLOCK 3: Mode 1 spec (dispatch review)\ngh pr view to get refs,\ngh workflow run agent-review-pr.yml,\npost acknowledgment, stop"]:::l3
    C["BLOCK 4: Mode 2 spec (read-only)\nread code, gh pr diff/view,\nnpm test/typecheck if needed,\nreply concisely"]:::l3
    D["BLOCK 5: Mode 3 spec (write)\ngh pr checkout, read diff/comments/reviews,\nedit, test + typecheck,\ncommit without Co-Authored-By,\npush to existing branch, summarize"]:::l4
    E["BLOCK 6: Rules\nexplicit-ask only, clarify if ambiguous,\nstay scoped, no new PRs or branches,\nno close unless told, be concise"]:::l5

    A --> B --> B1
    B --> C
    B --> D
    B1 --> E
    C --> E
    D --> E
    E --> X[("Claude receives this as its prompt\nplus the comment event payload\nvia GITHUB_EVENT_PATH")]
```

Each block answers one question:

| Block | Question it answers |
|-------|---------------------|
| 1. Identity | "Who am I and where do I get context?" |
| 2. Determine | "Which of the three modes applies?" |
| 3. Mode 1 spec | "How do I dispatch a review pipeline?" |
| 4. Mode 2 spec | "How do I answer without touching code?" |
| 5. Mode 3 spec | "How do I revise without breaking PR conventions?" |
| 6. Rules | "What am I forbidden from doing?" |

[Back to top](#navigate)

---

## 7. Filesystem reads and writes

Blue is read, orange is write, purple is both. The footprint is intentionally small.

```mermaid
flowchart LR
    classDef read fill:#1e3a8a,color:#fff,stroke:#000
    classDef write fill:#9a3412,color:#fff,stroke:#000
    classDef both fill:#581c87,color:#fff,stroke:#000

    subgraph reads["READ"]
        r1["CLAUDE.md\nproject philosophy, conventions, commands"]:::read
        r2["src/**, *.test.ts\nread on demand for review or fix"]:::read
        r3["package.json\nfor scripts and version checks"]:::read
        r4["PR diff via gh CLI\nnot a file but a GitHub fetch"]:::read
    end

    subgraph writes["WRITE (only in Mode 2)"]
        w1["src/**, *.test.ts, docs/**\nfiles already in the PR scope"]:::write
        w2["git commit to existing PR branch\nno new branches"]:::write
        w3["reply comment on the issue/PR\nposted via gh CLI"]:::write
    end

    subgraph both["READ then WRITE"]
        b1["working tree on PR branch\ngh pr checkout fetches it, edits land here"]:::both
    end

    r1 --> w3
    r2 --> w1
    r4 --> b1
    b1 --> w2
```

What is deliberately NOT touched:

- `scripts/agents/logs/**` (this is not a maintenance agent run; nothing to log)
- new branches under `agent/...` (not its job)
- the `development` or `main` branch (commits go to the existing PR branch only)

[Back to top](#navigate)

---

## 8. External calls

Who is contacted, with what credential, why.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef llm fill:#581c87,color:#fff,stroke:#000
    classDef gh fill:#1f2937,color:#fff,stroke:#000

    subgraph Pre["Before the bot starts"]
        c1["actions/create-github-app-token@v1\nauth: APP_ID + APP_PRIVATE_KEY\nwhy: mint bot identity"]:::pre
        c2["actions/checkout@v4\nauth: bot token\nwhy: full history, fetch-depth 0"]:::pre
        c3["actions/setup-node@v4\nauth: none\nwhy: Node 20, npm cache"]:::pre
        c4["npm ci\nauth: none\nwhy: install deps so npm test runs"]:::pre
    end

    subgraph During["While the bot runs"]
        d1["api.anthropic.com\nauth: CLAUDE_CODE_OAUTH_TOKEN\nwhy: model inference (vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6)\ncost meter: --max-turns 50"]:::llm
        d2["api.github.com (gh CLI)\nauth: bot token\nwhy: pr view, pr diff, pr checkout,\nissue comment, /pulls/N/reviews"]:::gh
        d3["origin remote (git push)\nauth: bot token\nwhy: push commits to existing PR branch\n(write mode only)"]:::gh
    end

    c1 --> c2 --> c3 --> c4 --> d1
    d1 --> d2
    d1 --> d3
```

Tool allowlist passed to `claude-code-action@v1`:

```
--allowedTools "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"
--max-turns 50
--model ${{ vars.ANTHROPIC_OPUS_LATEST || 'claude-opus-4-6' }}
```

Same allowlist and turn budget as `agent-run.yml` (both 50). Earlier this workflow ran with a tighter budget of 30, but conversational fixes and multi-step PR revisions outgrew that ceiling.

[Back to top](#navigate)

---

## 9. Rules and guardrails

The prompt enumerates six hard rules. Visual checklist of what the bot may and may not do.

```mermaid
flowchart TB
    classDef may fill:#064e3b,color:#fff,stroke:#000
    classDef mayNot fill:#7c2d12,color:#fff,stroke:#000
    classDef cond fill:#1e3a8a,color:#fff,stroke:#000

    subgraph MAY["MAY do"]
        m1["dispatch agent-review-pr.yml\n(Mode 1, when review requested on a PR)"]:::may
        m1b["answer questions\n(Mode 2, always allowed)"]:::may
        m2["read any source file"]:::may
        m3["run npm test, npm run typecheck"]:::may
        m4["commit + push to existing PR branch\n(only when explicitly asked, Mode 3)"]:::may
        m5["ask for clarification on ambiguous asks"]:::may
        m6["reply with concise comment + file:line refs"]:::may
    end

    subgraph MAYNOT["MAY NOT do"]
        n1["create a new PR"]:::mayNot
        n2["create a new branch"]:::mayNot
        n3["close issues or PRs\n(unless explicitly told)"]:::mayNot
        n4["add Co-Authored-By trailers to commits"]:::mayNot
        n5["act without an explicit ask\n(no proactive 'while I'm here' fixes)"]:::mayNot
        n6["refactor outside the asked scope"]:::mayNot
        n7["guess on ambiguous instructions"]:::mayNot
    end

    subgraph WHEN["Conditional"]
        w1["push commits ONLY if\nmaintainer used wording like\nfix this, revise, address feedback,\nupdate the PR, make these changes"]:::cond
        w2["commits MUST pass\nnpm test AND npm run typecheck\nbefore push"]:::cond
    end

    m4 --- w1
    m4 --- w2
```

Source: [.github/workflows/bot-respond.yml](../workflows/bot-respond.yml) lines 103-109 plus the mode bodies above.

[Back to top](#navigate)

---

## 10. Output cascade

What the bot produces and who eats it.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    BR["bot-respond.yml\nrun completes"]:::src

    BR --> O1["reply comment on issue/PR\n(always, all modes)"]:::out
    BR --> O2["commits pushed to existing PR branch\n(write mode only)"]:::out
    BR --> O3["gh workflow run agent-review-pr.yml\n(review dispatch mode only)"]:::out

    O1 --> H1["maintainer reads reply"]:::human
    O1 --> H2["may post another @llm-exe-bot mention\n(re-enters this workflow)"]:::human

    O2 --> C1["tests.yml\nfires on PR sync\nNode 18, 20, 22, 24"]:::cons
    O2 --> C2["agent-review-pr.yml\nfires on agent/* PR sync"]:::cons
    O2 --> H3["maintainer reviews the new commits\nand merges or requests more changes"]:::human

    O3 --> C3["agent-review-pr.yml\ntests + review + decide pipeline"]:::cons

    H2 -.loop.-> BR
```

Note the loop: a maintainer can keep iterating with the bot in the same PR thread. Each mention is an independent event; the bot rereads PR state each time.

[Back to top](#navigate)

---

## 11. State machine

A single mention as a finite state machine.

```mermaid
stateDiagram-v2
    [*] --> Filtering: issue_comment created
    Filtering --> Dropped: any predicate fails
    Filtering --> Booting: all three predicates pass
    Booting --> Setup: token + checkout + node + npm ci
    Setup --> Reading: action starts, reads CLAUDE.md and the mention
    Reading --> Clarifying: ambiguous ask
    Reading --> Dispatching: review request on a PR
    Reading --> ReadOnly: question or opinion
    Reading --> Writing: explicit fix / revise / update
    Dispatching --> Replying: post acknowledgment after gh workflow run
    Clarifying --> Replying
    ReadOnly --> Investigating: gh pr view, gh pr diff, code reads
    Investigating --> Replying
    Writing --> Checkout: gh pr checkout (number)
    Checkout --> Editing
    Editing --> Verifying: npm test + npm run typecheck
    Verifying --> Editing: failure - try again within budget
    Verifying --> Committing: both pass
    Committing --> Pushing: commit without Co-Authored-By
    Pushing --> Replying
    Replying --> Done: reply comment posted
    Writing --> TimedOut: 20-minute job timeout OR max-turns 50
    Editing --> TimedOut
    Verifying --> TimedOut
    TimedOut --> Done: action exits, no further reply guaranteed
    Dropped --> [*]
    Done --> [*]
```

There is no clock-out step like `agent-run.yml`. If the action is killed mid-flight, the only externally visible signs are: no reply comment, and possibly partial commits if the kill happened between push and reply.

[Back to top](#navigate)

---

## 12. Failure modes

Where things break, what happens, what to do.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["Troll or stranger\ncomments '@llm-exe-bot do X'"]:::fail
    F1 --> F1E["author_association check fails\njob skipped before any step\nno reply, no compute spent"]:::effect
    F1E --> F1X["working as designed\nupgrade contributor to COLLABORATOR\nif legitimate"]:::fix

    F2["Bot's own comment\ncontains '@llm-exe-bot'"]:::fail
    F2 --> F2E["user.login check fails\nself-loop prevented"]:::effect
    F2E --> F2X["working as designed"]:::fix

    F3["Bot token mint fails\nAPP_ID or APP_PRIVATE_KEY wrong"]:::fail
    F3 --> F3E["job fails at token step\nno reply posted"]:::effect
    F3E --> F3X["rotate App key, re-add secret"]:::fix

    F4["npm ci fails"]:::fail
    F4 --> F4E["job fails before action starts\nno reply, maintainer sees red X on the comment workflow"]:::effect
    F4E --> F4X["check package-lock alignment"]:::fix

    F5["Action hits --max-turns 50"]:::fail
    F5 --> F5E["bot returns whatever it has\nmay be partial work in write mode"]:::effect
    F5E --> F5X["re-mention to continue\nor break ask into smaller pieces"]:::fix

    F6["Job exceeds 20-minute timeout"]:::fail
    F6 --> F6E["runner kills the step\nno guaranteed reply\npossible partial push if kill landed after commit"]:::effect
    F6E --> F6X["maintainer re-mentions\nor inspects PR branch for partial state"]:::fix

    F7["Write mode requested\nwhen there is no PR context\n(plain issue, no associated PR)"]:::fail
    F7 --> F7E["bot has no branch to push to\nrules forbid creating one"]:::effect
    F7E --> F7X["bot replies asking for clarification\nor maintainer opens PR first"]:::fix

    F8["npm test or typecheck fails\nafter bot's edits"]:::fail
    F8 --> F8E["rules forbid pushing\nbot must iterate within turn budget"]:::effect
    F8E --> F8X["if turns run out, bot replies with\nwhat failed and stops short of push"]:::fix

    F9["Two simultaneous mentions\nin the same PR thread"]:::fail
    F9 --> F9E["no concurrency group declared\nboth jobs run in parallel\nrace on git push possible"]:::effect
    F9E --> F9X["maintainer avoids stacking asks\nor accepts last-write-wins on the branch"]:::fix

    F10["Anthropic API outage"]:::fail
    F10 --> F10E["action errors out\nno reply posted"]:::effect
    F10E --> F10X["wait and re-mention"]:::fix
```

[Back to top](#navigate)

---

## 13. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/bot-respond.yml"]:::v
    K2["Trigger"]:::k --- V2["issue_comment created"]:::v
    K3["Filter"]:::k --- V3["mention + not-bot + OWNER/MEMBER/COLLABORATOR"]:::v
    K4["Permissions"]:::k --- V4["contents/issues/PR: write, id-token: write"]:::v
    K5["Timeout"]:::k --- V5["20 minutes"]:::v
    K6["Concurrency"]:::k --- V6["none declared (parallel mentions allowed)"]:::v
    K7["Identity"]:::k --- V7["llm-exe-bot[bot] via App token"]:::v
    K8["Model"]:::k --- V8["vars.ANTHROPIC_OPUS_LATEST or claude-opus-4-6"]:::v
    K9["Max turns"]:::k --- V9["50"]:::v
    K10["Tool allowlist"]:::k --- V10["Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch"]:::v
    K11["Prompt source"]:::k --- V11["inline in yml (no template file)"]:::v
    K12["Modes"]:::k --- V12["1 dispatch review pipeline, 2 read-only Q and A, 3 write to existing PR"]:::v
    K13["Branch policy"]:::k --- V13["never create new; push to existing PR branch only"]:::v
    K14["Commit policy"]:::k --- V14["no Co-Authored-By; tests + typecheck must pass"]:::v
    K15["Reply policy"]:::k --- V15["always reply with concise comment + file:line refs"]:::v
    K16["Ambiguity policy"]:::k --- V16["ask for clarification, never guess"]:::v
```

Direct links:

- Workflow file: [.github/workflows/bot-respond.yml](../workflows/bot-respond.yml)
- Project context the bot reads: [CLAUDE.md](../../CLAUDE.md)
- Sibling deep dive: [AGENT_RUN_DEEP_DIVE.md](AGENT_RUN_DEEP_DIVE.md)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)

[Back to top](#navigate)
