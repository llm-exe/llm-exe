# draft-main-pr: Visual Deep Dive

Concentrated diagrams for [.github/workflows/draft-main-pr.yml](../workflows/draft-main-pr.yml) and the release-queue mechanics it implements. Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers](#2-triggers)
- [3. The one-job DAG](#3-the-one-job-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. The version comparison algorithm](#5-the-version-comparison-algorithm)
- [6. The patch-bump path](#6-the-patch-bump-path)
- [7. The PR title aggregation](#7-the-pr-title-aggregation)
- [8. The draft PR creation/update path](#8-the-draft-pr-creationupdate-path)
- [9. External calls](#9-external-calls)
- [10. Output cascade](#10-output-cascade)
- [11. The state machine](#11-the-state-machine)
- [12. Failure modes](#12-failure-modes)
- [13. Quick reference card](#13-quick-reference-card)

---

## 1. The whole picture

How [draft-main-pr.yml](../workflows/draft-main-pr.yml) plugs into the release pipeline.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        t1["pull_request closed\nbase: development"]:::trig
        t2["release published"]:::trig
    end

    subgraph G["Skip Gate"]
        sk["if: release OR\n(merged AND base=development\nAND head != bump-version-branch)"]:::gate
    end

    subgraph J["draft-main-pr.yml (single job)"]
        Jb["draft-dev-to-main-pr\nubuntu-latest"]:::job
    end

    subgraph S["Identity"]
        s1["APP_ID + APP_PRIVATE_KEY"]:::file
        bot["llm-exe-bot[bot]\nshort-lived token"]:::file
    end

    subgraph F["Files read/written"]
        tags["git tags\n(latest vX.Y.Z)"]:::file
        pkg["package.json\n.version"]:::file
        merges["git log on origin/development\n(--merges only)"]:::file
    end

    subgraph X["External"]
        ghpr["GitHub PR API\n(create, edit, merge)"]:::ext
        ghbr["GitHub branches\n(push bump-version-branch)"]:::ext
    end

    subgraph O["Outputs"]
        o1["draft PR\ndevelopment -&gt; main\ntitle: Draft PR for release version vX.Y.Z"]:::out
        o2["bump-version-branch PR\n(merged --admin --squash, then deleted)"]:::out
        o3["package.json version bumped\non development"]:::out
    end

    subgraph D["Downstream"]
        d1["maintainer marks draft ready"]:::job
        d2["check-semantic-versioning.yml\nfires on PRs to main"]:::job
        d3["release published\n(re-triggers this workflow)"]:::job
    end

    t1 --> sk
    t2 --> sk
    sk -->|pass| Jb
    sk -.->|bump-version-branch merge| skip(["skip"])
    s1 --> bot
    bot --> Jb
    Jb --> tags
    Jb --> pkg
    Jb --> merges
    Jb --> ghpr
    Jb --> ghbr
    Jb --> o1
    Jb --> o2
    Jb --> o3
    o2 --> t1
    o3 --> o1
    o1 --> d1
    d1 --> d2
    d1 --> d3
    d3 --> t2
```

[Back to top](#navigate)

---

## 2. Triggers

Two entry points. One skip gate to prevent recursion.

```mermaid
flowchart TB
    classDef ev fill:#0e7490,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|pull_request| pr{closed AND base=development?}
    ev -->|release| rel{action=published?}

    pr -->|no| stopA([no match, skipped])
    pr -->|yes| merge{merged == true?}
    rel -->|yes| proceed[(run job)]:::out
    rel -->|no| stopB([no match, skipped])

    merge -->|false| skipC([closed but not merged, skipped])
    merge -->|true| headref{head.ref == bump-version-branch?}

    headref -->|yes| skipD([avoid recursion, skipped]):::gate
    headref -->|no| proceed
```

Source: [.github/workflows/draft-main-pr.yml](../workflows/draft-main-pr.yml) lines 3-11 (triggers), line 21 (skip gate).

Why the bump-version-branch exclusion exists: this workflow opens a PR from `bump-version-branch` to `development` and admin-merges it. That merge is itself a `pull_request closed to development` event, which would re-trigger the workflow infinitely. The `head.ref != 'bump-version-branch'` clause breaks the loop.

[Back to top](#navigate)

---

## 3. The one-job DAG

Single job, twelve sequential steps. No matrix, no parallelism.

```mermaid
flowchart TB
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef cond fill:#7c2d12,color:#fff,stroke:#000
    classDef boot fill:#1e3a8a,color:#fff,stroke:#000

    start([event passes skip gate])
    start --> J1

    subgraph J1["draft-dev-to-main-pr (ubuntu-latest)"]
        direction TB
        s1["1. checkout fetch-depth: 0"]:::boot
        s2["2. Generate bot token"]:::boot
        s3["3. Get latest release version\n(git tag + grep regex)"]:::step
        s4["4. Get package.json version (jq)"]:::step
        s5["5. Check version comparison\n(awk %d%03d%03d)"]:::step
        s6["6. Determine next semantic version"]:::step
        s7["7. Check if PR exists\n(gh pr list)"]:::step
        s8["8. Get merged PR titles\n(merge-base + git log --merges)"]:::step
        s9["9. Check for new commits\n(rev-list --count)"]:::step
        s10["10. Bump version + branch + push + PR + admin merge\n(5 sub-steps, gated on BUMP_VERSION AND NEW_COMMITS)"]:::cond
        s11["11. Create or update draft PR\n(gated on NEW_COMMITS)"]:::cond
        s1 --> s2 --> s3 --> s4 --> s5 --> s6 --> s7 --> s8 --> s9 --> s10 --> s11
    end
```

There is no `if: always()` clock-out. If any step fails, the run halts and leaves state as-is. The next event re-runs the whole chain.

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

One run from event to draft PR, with every external touchpoint.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event
    participant J as draft-dev-to-main-pr
    participant T as Token mint
    participant G as Git (local clone)
    participant TAG as Git tags
    participant PKG as package.json
    participant GH as GitHub API
    participant REM as origin remote

    E->>J: pull_request closed OR release published
    Note over J: skip gate evaluated
    J->>G: checkout fetch-depth 0
    J->>T: create-github-app-token@v1
    T-->>J: bot token
    J->>TAG: git tag --sort=-v:refname | grep
    TAG-->>J: LATEST_VERSION (or v0.0.0)
    J->>PKG: jq -r .version
    PKG-->>J: PACKAGE_VERSION
    Note over J: convert both via awk and compare
    J->>J: set BUMP_VERSION + CURRENT_VERSION
    J->>J: parse and increment PATCH if needed, set NEW_VERSION
    J->>GH: gh pr list --base main --head development
    GH-->>J: PR_URL or empty, set PR_EXISTS
    J->>G: git fetch origin main development
    J->>G: git merge-base origin/main origin/development
    G-->>J: MERGE_BASE sha
    J->>G: git log MERGE_BASE..origin/development --merges
    G-->>J: merge commit subjects
    J->>J: grep -oP for PR numbers
    loop for each PR number
        J->>GH: gh pr view N --json number,title
        GH-->>J: title line
    end
    J->>G: git rev-list --count origin/main..origin/development
    G-->>J: NEW_COMMITS true or false
    alt BUMP_VERSION=true AND NEW_COMMITS=true
        J->>PKG: jq write new patch version
        J->>G: commit, checkout -b bump-version-branch
        J->>REM: push origin bump-version-branch (force fallback)
        J->>GH: gh pr create base=development head=bump-version-branch
        J->>GH: gh pr merge --admin --squash --delete-branch
        Note over GH: triggers pull_request closed AND skip gate filters it
    end
    alt NEW_COMMITS=true
        alt PR_EXISTS=true
            J->>GH: gh pr edit PR_URL --title --body
        else
            J->>GH: gh pr create --base main --head development --draft
        end
    end
```

Source: [.github/workflows/draft-main-pr.yml](../workflows/draft-main-pr.yml) lines 23-297.

[Back to top](#navigate)

---

## 5. The version comparison algorithm

The awk `%d%03d%03d` trick packs `MAJOR.MINOR.PATCH` into a single comparable integer.

```mermaid
flowchart TB
    classDef in fill:#0e7490,color:#fff,stroke:#000
    classDef calc fill:#374151,color:#fff,stroke:#000
    classDef dec fill:#7c2d12,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    A["git tag --sort=-v:refname\n| grep -E '^v[0-9]+\\.[0-9]+\\.[0-9]+$'\n| head -n 1"]:::in
    A --> A1{tag found?}
    A1 -->|no| A2["LATEST_VERSION = v0.0.0"]:::calc
    A1 -->|yes| A3["LATEST_VERSION = matched tag"]:::calc
    A2 --> A4["strip leading 'v'"]:::calc
    A3 --> A4

    B["jq -r .version &lt; package.json"]:::in
    B --> B1["PACKAGE_VERSION"]:::calc

    B1 --> PRE{PACKAGE_VERSION\ncontains '-'?\n(pre-release suffix)}:::dec
    PRE -->|yes| PR1["IS_PRERELEASE=true\nBUMP_VERSION=false\nCURRENT_VERSION=PACKAGE_VERSION\nNEW_VERSION = v + full version (with -suffix)\nskip rest of compare"]:::out
    PRE -->|no| CV2["awk -F. '{ printf %d%03d%03d, $1,$2,$3 }'\non PACKAGE_VERSION"]:::calc

    A4 --> CV1["awk -F. '{ printf %d%03d%03d, $1,$2,$3 }'\non LATEST_VERSION"]:::calc

    CV1 --> EX1["LATEST_VERSION_NUM\nexample: 2.13.4 -&gt; 2013004"]:::calc
    CV2 --> EX2["PACKAGE_VERSION_NUM\nexample: 2.13.4 -&gt; 2013004"]:::calc

    EX1 --> D{PACKAGE_VERSION_NUM\n&lt;=\nLATEST_VERSION_NUM?}:::dec
    EX2 --> D

    D -->|yes| O1["BUMP_VERSION=true\nCURRENT_VERSION=LATEST_VERSION\n(package didn't lead, must bump)"]:::out
    D -->|no| O2["BUMP_VERSION=false\nCURRENT_VERSION=PACKAGE_VERSION\n(package already ahead, use it)"]:::out

    O1 --> N1["parse CURRENT_VERSION via regex\nPATCH = PATCH + 1\nNEW_VERSION = vMAJOR.MINOR.PATCH"]:::calc
    O2 --> N2["parse CURRENT_VERSION via regex\nPATCH unchanged\nNEW_VERSION = vMAJOR.MINOR.PATCH"]:::calc
```

The pre-release branch is the maintainer's manual lane: when `package.json` declares a `-beta.X` / `-rc.X` / `-alpha.X` version, the workflow never auto-bumps and never enters the patch-increment path. The maintainer drives `beta.0 -> beta.1 -> ... -> final` by hand. The draft PR title still updates with the current pre-release version.

Why `%03d` zero-padding works: `1.9.0` becomes `1009000`, `1.10.0` becomes `1010000`. Without padding, lexical string comparison would put `1.10.0` before `1.9.0`. With three-digit zero-padding, integer comparison is correct for any `MINOR` or `PATCH` under 1000.

Limits: any segment at or above 1000 overflows into the next field and breaks ordering. For `llm-exe` this is fine. The awk compare is only used for stable releases; pre-releases short-circuit before it ever runs.

Source: lines 54-117 (including pre-release short-circuit at lines 60-67 and 96-100).

[Back to top](#navigate)

---

## 6. The patch-bump path

When the workflow self-bumps `package.json` on `development`, and how the resulting merge does not re-trigger an infinite loop.

```mermaid
flowchart TB
    classDef cond fill:#7c2d12,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000
    classDef skip fill:#1e3a8a,color:#fff,stroke:#000

    A([step 10 starts])
    A --> G1{BUMP_VERSION == true\nAND\nNEW_COMMITS == true?}:::cond
    G1 -->|no (skipped on pre-release or already-ahead version)| OUT1([all 5 sub-steps skipped]):::skip
    G1 -->|yes| S1["re-read latest tag\nparse MAJOR/MINOR/PATCH\nPATCH = PATCH + 1\nNEW_VERSION = MAJOR.MINOR.PATCH (no v)"]:::step
    S1 --> S2["jq write package.json\ngit config github-actions[bot]\ngit add + commit\n'chore: bump version number on PR to main'"]:::step
    S2 --> S3["git checkout -b bump-version-branch\n(or checkout if already exists)\ngit pull origin bump-version-branch || true"]:::step
    S3 --> S4["git push origin bump-version-branch\n|| git push --force"]:::step
    S4 --> S5["gh pr create\n--base development\n--head bump-version-branch\ntitle: 'Bump Version on PR to Main'"]:::step
    S5 --> S6["gh pr merge N\n--admin --squash --delete-branch"]:::step
    S6 --> EV[("emits pull_request closed event\nbase=development\nhead=bump-version-branch")]:::out
    EV --> SK{skip gate filter}:::cond
    SK -->|head.ref == bump-version-branch| OUT2([workflow run skipped]):::skip
    SK -.->|hypothetical re-run| LOOP([infinite loop])
```

Recursion control: step 11 (the draft PR step) runs on the same execution as step 10, so the version bump and the draft PR title are kept consistent within one run. The bump-version-branch merge that follows is filtered by the skip gate at line 21, so it does not start a second run that would race the first.

Source: lines 187-249 (the 5 bump sub-steps), line 21 (skip gate).

[Back to top](#navigate)

---

## 7. The PR title aggregation

How merged PRs since the last release are discovered and rendered into the draft PR body.

```mermaid
flowchart TB
    classDef in fill:#0e7490,color:#fff,stroke:#000
    classDef calc fill:#374151,color:#fff,stroke:#000
    classDef gh fill:#1f2937,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    F1["git fetch origin main development"]:::in
    F1 --> F1a{fetch ok?}
    F1a -->|no| ERR([exit 1])
    F1a -->|yes| MB["git merge-base origin/main origin/development"]:::calc
    MB --> MBO["MERGE_BASE = common ancestor sha"]:::calc

    MBO --> LG["git log MERGE_BASE..origin/development\n--merges --pretty=format:'%s'"]:::calc
    LG --> LGO["merge commit subjects\nlike 'Merge pull request #501 from ...'"]:::calc

    LGO --> GR["grep -oP 'Merge pull request #\\K[0-9]+'\n|| true"]:::calc
    GR --> GRO["PR_NUMBERS\n(newline-separated, may be empty)"]:::calc

    GRO --> LOOP{for each pr_num}
    LOOP -->|pr_num non-empty| GH1["gh pr view pr_num\n--json number,title\n--jq '\"- #(.number): (.title)\"'"]:::gh
    GH1 -->|success| APP["append line + literal \\n to PR_TITLES"]:::calc
    GH1 -->|fail| WARN["log warning, skip this number"]:::calc
    APP --> LOOP
    WARN --> LOOP
    LOOP -->|done| CT["PR_COUNT = grep -c '^- #'\non PR_TITLES (or 0)"]:::calc

    CT --> EXP1["export PR_TITLES heredoc to GITHUB_ENV"]:::out
    CT --> EXP2["export PR_COUNT to GITHUB_ENV"]:::out
```

Notes on robustness:

- `|| true` after `grep -oP` ensures an empty merge log does not fail the step under `set -e`.
- The PR-view loop swallows individual failures with `2>/dev/null` and a warning, so one missing PR (deleted, private, etc) does not poison the whole release body.
- `PR_TITLES` is always exported, even if empty, to prevent unbound variable errors in step 11.

Squash-merged PRs without the literal `Merge pull request #N` subject are missed by the grep. The `llm-exe` repo currently uses merge commits for PR integration, so this works in practice.

Source: lines 115-166.

[Back to top](#navigate)

---

## 8. The draft PR creation/update path

Idempotent: the workflow either creates the draft PR or updates the existing one.

```mermaid
flowchart TB
    classDef in fill:#0e7490,color:#fff,stroke:#000
    classDef calc fill:#374151,color:#fff,stroke:#000
    classDef dec fill:#7c2d12,color:#fff,stroke:#000
    classDef gh fill:#1f2937,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    A([step 11 starts])
    A --> G{NEW_COMMITS == true?}:::dec
    G -->|no| SK([skip the whole step])
    G -->|yes| B1{PR_COUNT &gt; 0?}:::dec
    B1 -->|yes| BODY1["PR_BODY =\n'## Changes in this release:\\n\\n'\n+ PR_TITLES\n+ '\\n\\nThis release includes N merged pull request(s)...'"]:::calc
    B1 -->|no| BODY2["PR_BODY =\n'## Changes in this release:\\n\\nThis release includes changes from the development branch.'"]:::calc

    BODY1 --> L{len(PR_BODY) &gt; 65000?}:::dec
    BODY2 --> L
    L -->|yes| TR["PR_BODY = PR_BODY[:65000]\n+ '\\n\\n... (truncated due to length)'"]:::calc
    L -->|no| KEEP["PR_BODY unchanged"]:::calc

    TR --> E{PR_EXISTS == true?}:::dec
    KEEP --> E

    E -->|yes| EDIT["gh pr edit PR_URL\n--title 'Draft PR for release version NEW_VERSION'\n--body PR_BODY"]:::gh
    E -->|no| CREATE["gh pr create\n--base main --head development\n--title 'Draft PR for release version NEW_VERSION'\n--body PR_BODY\n--draft"]:::gh

    EDIT --> EOK{exit 0?}
    CREATE --> COK{exit 0?}
    EOK -->|no| ERR1([exit 1])
    EOK -->|yes| OUT([draft PR up to date]):::out
    COK -->|no| ERR2([exit 1])
    COK -->|yes| OUT
```

The 65k character cap exists because GitHub PR bodies have a hard limit and very large bodies can intermittently fail with truncation errors. The cap sits below that limit with margin for the trailing "truncated" note.

Source: lines 251-297.

[Back to top](#navigate)

---

## 9. External calls

Who is contacted, with what credential, why.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef git fill:#1f2937,color:#fff,stroke:#000
    classDef gh fill:#581c87,color:#fff,stroke:#000
    classDef rem fill:#064e3b,color:#fff,stroke:#000

    subgraph Boot["Before logic begins"]
        c1["actions/checkout@v4\nfetch-depth: 0\nwhy: full tag history + merge-base"]:::pre
        c2["actions/create-github-app-token@v1\nauth: APP_ID + APP_PRIVATE_KEY\nwhy: bot identity for gh, git push"]:::pre
    end

    subgraph Git["Local git commands"]
        g1["git tag --sort=-v:refname"]:::git
        g2["git fetch origin main development"]:::git
        g3["git merge-base origin/main origin/development"]:::git
        g4["git log MERGE_BASE..origin/development --merges"]:::git
        g5["git rev-list --count origin/main..origin/development"]:::git
        g6["git add + commit\nuser: github-actions[bot]"]:::git
        g7["git checkout -b bump-version-branch"]:::git
    end

    subgraph GH["gh CLI calls"]
        h1["gh pr list --base main --head development\nwhy: idempotency check"]:::gh
        h2["gh pr view N --json number,title\nwhy: enrich merge log with titles"]:::gh
        h3["gh pr create --base development --head bump-version-branch\nwhy: open bump PR"]:::gh
        h4["gh pr merge N --admin --squash --delete-branch\nwhy: self-merge bump PR"]:::gh
        h5["gh pr create --base main --head development --draft\nwhy: open release queue PR"]:::gh
        h6["gh pr edit PR_URL --title --body\nwhy: keep release queue PR fresh"]:::gh
    end

    subgraph Remote["origin remote"]
        r1["git push origin bump-version-branch\n(force fallback)"]:::rem
    end

    c1 --> g1
    c2 --> h1
    g1 --> g2
    g2 --> g3
    g3 --> g4
    g4 --> h2
    g4 --> g5
    g6 --> g7
    g7 --> r1
    r1 --> h3
    h3 --> h4
    h1 --> h5
    h1 --> h6
```

All `gh` calls export both `GH_TOKEN` and `GITHUB_TOKEN` from the bot token output. The bot identity is what makes the resulting PRs and commits eligible to trigger downstream workflows (the default `GITHUB_TOKEN` would silently skip recursive triggers).

[Back to top](#navigate)

---

## 10. Output cascade

What this workflow produces and who consumes it.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    DR["draft-main-pr.yml\nrun completes"]:::src

    DR --> O1["draft PR development -&gt; main\ntitle: 'Draft PR for release version vX.Y.Z'\nbody: merged PR list"]:::out
    DR --> O2["bump-version-branch PR\n(only when BUMP_VERSION=true AND NEW_COMMITS=true)"]:::out
    DR --> O3["package.json patched on development\n(via squash-merge of bump PR)"]:::out

    O2 --> SELF["pull_request closed event\nfor bump-version-branch\nfiltered by skip gate -&gt; no re-run"]:::cons

    O1 --> M["maintainer reviews release queue\n(sees titles, decides timing)"]:::human
    M --> RDY["maintainer marks PR ready for review\n(undraft)"]:::human

    RDY --> CSV["check-semantic-versioning.yml\nfires on PRs to main\nvalidates version vs base"]:::cons
    RDY --> TST["tests.yml\nfires on PR open/sync"]:::cons
    RDY --> MR["maintainer merges to main"]:::human
    MR --> REL["GitHub release published"]:::human
    REL --> RT["release published event\nre-triggers draft-main-pr.yml\nfor next cycle"]:::cons
    RT --> DR

    O3 --> NXT["next pull_request closed to development\nreads the new package.json version\nBUMP_VERSION likely false now"]:::cons
```

The draft PR is the release queue. Every merge to `development` and every published release refreshes its title and body, so the maintainer always sees a current view of what is in flight.

Why the cascade does not cycle uncontrollably: the bump-version-branch event is filtered at the skip gate, and the only events that re-enter the workflow are real merges to development or human-published releases.

[Back to top](#navigate)

---

## 11. The state machine

One run as a finite state machine across all branches of logic.

```mermaid
stateDiagram-v2
    [*] --> Queued: event arrives
    Queued --> SkipChecking: workflow starts
    SkipChecking --> Skipped: bump-version-branch merge
    SkipChecking --> Booting: real event
    Booting --> Setup: checkout + token
    Setup --> VersionRead: read tags + package.json
    VersionRead --> PreReleaseCheck: package.json version has -suffix?
    PreReleaseCheck --> PreReleaseLane: yes (IS_PRERELEASE=true, BUMP_VERSION=false)
    PreReleaseCheck --> Compared: no (awk packed integer compare)
    Compared --> BumpDecided: BUMP_VERSION set
    BumpDecided --> NextVersionSet: NEW_VERSION computed
    PreReleaseLane --> NextVersionSet: NEW_VERSION = v + full pre-release version
    NextVersionSet --> PRChecked: gh pr list result -&gt; PR_EXISTS
    PRChecked --> TitlesFetched: PR_TITLES + PR_COUNT
    TitlesFetched --> CommitsChecked: NEW_COMMITS set

    CommitsChecked --> NoNewCommits: NEW_COMMITS=false
    CommitsChecked --> NeedsBump: BUMP_VERSION=true AND NEW_COMMITS=true
    CommitsChecked --> NoBumpDraftOnly: BUMP_VERSION=false AND NEW_COMMITS=true

    NeedsBump --> Bumping: edit package.json, commit
    Bumping --> BranchPushed: push bump-version-branch
    BranchPushed --> BumpPRMerged: gh pr create + admin squash merge
    BumpPRMerged --> DraftPRStep: continue to step 11

    NoBumpDraftOnly --> DraftPRStep
    NoNewCommits --> Completed: nothing to publish

    DraftPRStep --> Updating: PR_EXISTS=true
    DraftPRStep --> Creating: PR_EXISTS=false
    Updating --> Completed: gh pr edit success
    Creating --> Completed: gh pr create success
    Updating --> Failed: gh pr edit error
    Creating --> Failed: gh pr create error

    Skipped --> [*]
    Completed --> [*]
    Failed --> [*]
```

There is no clock-out step. A failure inside the bump path leaves `bump-version-branch` partly pushed but no bump PR open, or an open bump PR un-merged. The next event re-enters the chain and re-discovers state via `gh pr list` and `git checkout -b ... || git checkout ...`.

[Back to top](#navigate)

---

## 12. Failure modes

Where things break, what happens, what to do.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["No tags exist yet"]:::fail
    F1 --> F1E["LATEST_VERSION defaults to v0.0.0\nfirst release lands as v0.0.1"]:::effect
    F1E --> F1X["expected behavior on a new repo"]:::fix

    F2["Squash-merged PRs to development\n(no 'Merge pull request #N' subject)"]:::fail
    F2 --> F2E["grep -oP misses them\nbody omits those titles\nPR_COUNT undercounts"]:::effect
    F2X["repo policy is merge commits;\nif switched to squash, the grep must be rewritten\nto parse another source (eg gh pr list --search merged-into:development)"]:::fix
    F2E --> F2X

    F3["No new commits between branches\n(NEW_COMMITS=false)"]:::fail
    F3 --> F3E["bump step skipped\ndraft PR step skipped\nrun ends clean"]:::effect
    F3X["expected behavior, not a failure"]:::fix
    F3E --> F3X

    F4["PR body exceeds 65000 chars\n(huge release window)"]:::fail
    F4 --> F4E["truncation kicks in\nbody clipped + '... (truncated due to length)'"]:::effect
    F4X["maintainer scrolls release in GitHub UI\nor cuts smaller releases more often"]:::fix
    F4E --> F4X

    F5["gh pr view fails for one PR number\n(deleted, permissions)"]:::fail
    F5 --> F5E["warning logged, that line skipped\nother PR titles still appear"]:::effect
    F5X["intentional graceful degradation"]:::fix
    F5E --> F5X

    F6["git fetch fails\n(network)"]:::fail
    F6 --> F6E["step 8 exits 1\nrest of run aborts\nno draft PR update this round"]:::effect
    F6X["next event retries\nidempotent so no cleanup needed"]:::fix
    F6E --> F6X

    F7["Bump PR creation conflict\n(branch already exists with stale state)"]:::fail
    F7 --> F7E["push falls back to --force\nthen gh pr create may fail if PR already open\nand admin merge looks up by --head filter"]:::effect
    F7X["close stale bump-version-branch PR manually\nand re-run"]:::fix
    F7E --> F7X

    F8["Package version already ahead\n(BUMP_VERSION=false)"]:::fail
    F8 --> F8E["bump path entirely skipped\ndraft PR still updated\nuses package.json version as NEW_VERSION"]:::effect
    F8X["intentional: lets a maintainer hand-bump for minor/major\nworkflow respects it"]:::fix
    F8E --> F8X

    F8b["Pre-release version in package.json\n(e.g. 3.0.0-beta.0)"]:::fail
    F8b --> F8bE["IS_PRERELEASE=true, BUMP_VERSION=false\nbump path skipped entirely\nNEW_VERSION preserves the full -suffix\ndraft PR title shows the pre-release version"]:::effect
    F8bX["intentional: maintainer drives beta.0 -> beta.1 -> ... -> final manually\nworkflow respects every hand-set pre-release version"]:::fix
    F8bE --> F8bX

    F9["Skip gate misses an edge case\n(bot identity rename, branch rename)"]:::fail
    F9 --> F9E["bump merge re-triggers workflow\ninfinite loop possible"]:::effect
    F9X["audit line 21 condition\nany change to bump-version-branch name\nmust update the gate"]:::fix
    F9E --> F9X

    F10["Bot token mint fails\n(APP_ID rotation lag)"]:::fail
    F10 --> F10E["all gh + git push steps fail\nrun aborts at first gh call"]:::effect
    F10X["rotate App key, re-add secret"]:::fix
    F10E --> F10X
```

[Back to top](#navigate)

---

## 13. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/draft-main-pr.yml"]:::v
    K2["Triggers"]:::k --- V2["pull_request closed (base: development) + release published"]:::v
    K3["Skip gate"]:::k --- V3["release OR (merged AND base=development AND head != bump-version-branch)"]:::v
    K4["Permissions"]:::k --- V4["contents/PR: write, id-token: write"]:::v
    K5["Runner"]:::k --- V5["ubuntu-latest"]:::v
    K6["Jobs"]:::k --- V6["one job, ~12 sequential steps"]:::v
    K7["Identity"]:::k --- V7["llm-exe-bot[bot] via App token"]:::v
    K8["Checkout depth"]:::k --- V8["fetch-depth: 0 (need tags + history)"]:::v
    K9["Version compare"]:::k --- V9["awk printf %d%03d%03d packed integer (stable only)"]:::v
    K9b["Pre-release lane"]:::k --- V9b["package.json version with '-' suffix skips auto-bump entirely; NEW_VERSION preserves full -PRERELEASE suffix"]:::v
    K10["Bump branch"]:::k --- V10["bump-version-branch (force-push fallback)"]:::v
    K11["Bump PR merge"]:::k --- V11["gh pr merge --admin --squash --delete-branch"]:::v
    K12["Release PR base"]:::k --- V12["main, head: development, draft"]:::v
    K13["Release PR title"]:::k --- V13["'Draft PR for release version vX.Y.Z'"]:::v
    K14["Body cap"]:::k --- V14["65000 chars, then truncated marker"]:::v
    K15["Title source"]:::k --- V15["git log --merges + gh pr view"]:::v
    K16["Commit author"]:::k --- V16["github-actions[bot]"]:::v
```

Direct links:

- Workflow file: [.github/workflows/draft-main-pr.yml](../workflows/draft-main-pr.yml)
- Related workflows: [check-semantic-versioning.yml](../workflows/check-semantic-versioning.yml), [pack-package.yml](../workflows/pack-package.yml), [tests.yml](../workflows/tests.yml)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)
- Companion deep dive: [AGENT_RUN_DEEP_DIVE.md](AGENT_RUN_DEEP_DIVE.md)

[Back to top](#navigate)
