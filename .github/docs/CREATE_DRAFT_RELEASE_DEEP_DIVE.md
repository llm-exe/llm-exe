# create-draft-release: Visual Deep Dive

Concentrated diagrams for [.github/workflows/create-draft-release.yml](../workflows/create-draft-release.yml) and the surrounding release pipeline it slots into. Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md).

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers](#2-triggers)
- [3. The one-job DAG](#3-the-one-job-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. The draft-wipe and recreate pattern](#5-the-draft-wipe-and-recreate-pattern)
- [6. The release notes cleaning rules](#6-the-release-notes-cleaning-rules)
- [7. External calls](#7-external-calls)
- [8. Output cascade](#8-output-cascade)
- [9. State machine](#9-state-machine)
- [10. Failure modes](#10-failure-modes)
- [11. Quick reference card](#11-quick-reference-card)

---

## 1. The whole picture

How [create-draft-release.yml](../workflows/create-draft-release.yml) sits inside the release pipeline.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    subgraph T["Triggers"]
        t1["pull_request closed\non branch main\n(must be merged)"]:::trig
        t2["workflow_dispatch\n(manual)"]:::trig
    end

    subgraph A["create-draft-release.yml"]
        J["update-draft-releases job\nubuntu-latest"]:::job
    end

    subgraph S["Auth"]
        s1["GITHUB_TOKEN\n(default, scoped to repo)"]:::file
    end

    subgraph F["Files touched"]
        f1["package.json\nread .version with jq"]:::file
        f2["release_ids.txt\ntmp: list of draft ids"]:::file
        f3["release_body.txt\ntmp: GitHub auto notes"]:::file
        f4["cleaned_body.txt\ntmp: post-sed notes"]:::file
    end

    subgraph X["GitHub Releases API"]
        x1["GET /releases\nfilter draft==true"]:::ext
        x2["DELETE /releases/&lt;id&gt;"]:::ext
        x3["POST /releases\ngenerate_release_notes: true"]:::ext
        x4["PATCH /releases/&lt;id&gt;\nbody: cleaned"]:::ext
    end

    subgraph O["Outputs"]
        o1["one draft release\ntag vMAJOR.MINOR.PATCH (optionally -PRERELEASE)\ntarget main\nprerelease flag set when version has -suffix"]:::out
    end

    subgraph H["Human gate"]
        h1["maintainer reviews\nedits notes if needed\nclicks Publish"]:::human
    end

    subgraph D["Downstream (on publish)"]
        d1["publish-release.yml\nfires on release: published"]:::job
        d2["deploy-docs.yml"]:::job
        d3["cache-cleanup.yml"]:::job
        d4["draft-main-pr.yml\nopens next dev to main PR"]:::job
    end

    t1 --> J
    t2 --> J
    s1 --> J
    J --> x1 --> f2
    f2 --> x2
    J --> f1
    f1 --> x3 --> f3
    f3 --> f4
    f4 --> x4 --> o1
    o1 --> h1
    h1 -->|publish| d1
    h1 -->|publish| d2
    h1 -->|publish| d3
    h1 -->|publish| d4
```

[Back to top](#navigate)

---

## 2. Triggers

Two entry points. Both gated by a job-level `if` that requires a merged PR or a manual run.

```mermaid
flowchart TB
    classDef event fill:#0e7490,color:#fff,stroke:#000
    classDef manual fill:#9333ea,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|pull_request| pr1{action == closed?}
    ev -->|workflow_dispatch| md[manual run]:::manual

    pr1 -->|yes| pr2{branches base == main?}
    pr1 -->|no| skip1([ignored, types filter])
    pr2 -->|yes| pr3{merged == true?}
    pr2 -->|no| skip2([ignored, branch filter])
    pr3 -->|yes| gate
    pr3 -->|no, PR closed without merge| skip3([if condition false, job skipped]):::gate

    md --> gate[run job]:::out
    pr3 --> gate
```

Source: [.github/workflows/create-draft-release.yml](../workflows/create-draft-release.yml) lines 3-9 (event filters) and line 22 (job-level `if`).

The `pull_request: closed` event fires on both merged and abandoned PRs. The `if: github.event.pull_request.merged == true || github.event_name == 'workflow_dispatch'` is what blocks the abandoned case.

[Back to top](#navigate)

---

## 3. The one-job DAG

Six steps in a single job. No matrix, no parallelism, no fan-out.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef api fill:#064e3b,color:#fff,stroke:#000

    start([trigger event passes if])
    start --> J

    subgraph J["Job: update-draft-releases (ubuntu-latest)"]
        direction TB
        s0["actions/checkout@v4"]:::step
        s1["Get all draft releases\ngh api ... | jq draft==true ids\nwrite release_ids.txt"]:::step
        s2["Delete old draft releases\nloop: gh api -X DELETE"]:::step
        s3["Determine next semantic version\njq -r .version package.json\nregex MAJOR.MINOR.PATCH(-PRERELEASE)?\nformat vMAJOR.MINOR.PATCH (preserve -suffix)\nexport NEW_VERSION + IS_PRERELEASE"]:::step
        s4["Create Draft Release on GitHub\nPOST /releases\nprerelease: IS_PRERELEASE\nmake_latest: legacy (stable) or false (prerelease)\ngenerate_release_notes: true\nsave release_id + release_url\nwrite release_body.txt"]:::step
        s5["Clean up release notes\nsed: drop 4 patterns\nstrip by @user in\nwrite cleaned_body.txt"]:::step
        s6["Update Draft Release with cleaned notes\nPATCH /releases/(id)\nbody: jq -Rs cleaned_body.txt"]:::step
        s0 --> s1 --> s2 --> s3 --> s4 --> s5 --> s6
    end

    J --> done([draft visible in Releases tab])
```

Steps share state through files on the runner (`release_ids.txt`, `release_body.txt`, `cleaned_body.txt`), `$GITHUB_ENV` (`NEW_VERSION`), and `$GITHUB_OUTPUT` (`release_id`, `release_url`).

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

One run from trigger to PATCH, with every API call and file write.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event (merged PR or dispatch)
    participant R as Runner
    participant API as GitHub Releases API
    participant PKG as package.json
    participant FS as Runner filesystem

    E->>R: trigger create-draft-release.yml
    R->>R: actions/checkout@v4 (default token)
    R->>API: GET /repos/(owner)/(repo)/releases
    API-->>R: full list (draft + published)
    R->>FS: jq draft==true ids > release_ids.txt
    loop For each id in release_ids.txt
        R->>API: DELETE /releases/(id)
        API-->>R: 204 No Content
    end
    R->>PKG: jq -r .version package.json
    PKG-->>R: e.g. 2.3.4 or 3.0.0-beta.0
    R->>R: regex validate MAJOR.MINOR.PATCH with optional -PRERELEASE suffix
    R->>R: NEW_VERSION = v + full version (including any -suffix)
    R->>R: IS_PRERELEASE = true if version contains "-", else false
    R->>R: export NEW_VERSION + IS_PRERELEASE via GITHUB_ENV
    R->>API: POST /releases (tag NEW_VERSION, target main, draft true, prerelease IS_PRERELEASE, make_latest legacy or false, generate_release_notes true)
    API-->>R: 201 with id, html_url, auto-generated body
    R->>FS: release_body.txt = body
    R->>FS: sed drop 4 patterns then strip " by @user in" then cleaned_body.txt
    R->>FS: jq -Rs '.' cleaned_body.txt (JSON-encode)
    R->>API: PATCH /releases/(release_id) with cleaned body
    alt success
        API-->>R: 200 with id
        R-->>E: log Release notes updated successfully
    else failure
        API-->>R: error JSON
        R-->>E: log Warning, do not exit (non-fatal)
    end
```

Source: [.github/workflows/create-draft-release.yml](../workflows/create-draft-release.yml) lines 24-113.

[Back to top](#navigate)

---

## 5. The draft-wipe and recreate pattern

Why we delete every existing draft before creating a new one instead of editing in place.

```mermaid
flowchart TB
    classDef bad fill:#7c2d12,color:#fff,stroke:#000
    classDef good fill:#064e3b,color:#fff,stroke:#000
    classDef neutral fill:#374151,color:#fff,stroke:#000

    start([new merge to main lands])
    start --> Q{update in place or wipe and recreate?}

    Q -->|update in place| U1["find existing draft by tag"]:::neutral
    U1 --> U2["tag may not match new version"]:::bad
    U2 --> U3["release notes are stale, must be regenerated anyway"]:::bad
    U3 --> U4["risk of multiple drafts piling up over time"]:::bad
    U4 --> U5["complexity: which draft is the live one?"]:::bad

    Q -->|wipe and recreate (chosen)| W1["GET /releases, filter draft==true"]:::good
    W1 --> W2["DELETE every draft id"]:::good
    W2 --> W3["state is now: zero drafts"]:::good
    W3 --> W4["POST /releases with fresh tag + auto notes"]:::good
    W4 --> W5["invariant: exactly one draft exists"]:::good
    W5 --> W6["each merge resets the slate"]:::good
```

The pattern guarantees the **one-draft invariant**: after every successful run, exactly one draft release exists and it reflects the current `package.json` version plus every commit since the last published tag.

[Back to top](#navigate)

---

## 6. The release notes cleaning rules

GitHub's auto-generated notes include automation noise we never want shipped to users. Five sed rules clean them.

```mermaid
flowchart TB
    classDef in fill:#0e7490,color:#fff,stroke:#000
    classDef drop fill:#7c2d12,color:#fff,stroke:#000
    classDef strip fill:#9a3412,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    A["release_body.txt\n(raw auto-generated notes from POST response)"]:::in

    A --> R1{line matches\n'chore: bump version'\n(case insensitive)?}
    R1 -->|yes| D1["DROP entire line"]:::drop
    R1 -->|no| R2

    R2{line matches\n'Draft PR for release'\n(case insensitive)?}
    R2 -->|yes| D2["DROP entire line"]:::drop
    R2 -->|no| R3

    R3{line matches\n'Bump Version on PR to Main'\n(case insensitive)?}
    R3 -->|yes| D3["DROP entire line"]:::drop
    R3 -->|no| R4

    R4{line matches\n'docs: sync'\n(case insensitive)?}
    R4 -->|yes| D4["DROP entire line"]:::drop
    R4 -->|no| K[KEEP line]

    K --> S{line contains\n' by @username in '?}
    S -->|yes| S1["STRIP the ' by @user in' segment\n(leaves PR link intact)"]:::strip
    S -->|no| S2[leave line unchanged]

    D1 --> Z[(cleaned_body.txt)]:::out
    D2 --> Z
    D3 --> Z
    D4 --> Z
    S1 --> Z
    S2 --> Z
```

The actual sed pipeline:

```
sed '/chore: bump version/Id; /Draft PR for release/Id; /Bump Version on PR to Main/Id; /docs: sync/Id' release_body.txt \
  | sed -E 's/ by @[^ ]+ in/ /g'
```

The `I` flag on each pattern makes the match case-insensitive. The `d` action deletes the matching line. The second sed strips contributor attribution for what amounts to bot PRs that exist purely to manage versioning.

[Back to top](#navigate)

---

## 7. External calls

Every network call, with credential and reason.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef api fill:#1f2937,color:#fff,stroke:#000
    classDef out fill:#064e3b,color:#fff,stroke:#000

    subgraph Pre["Before API work"]
        p1["actions/checkout@v4\nauth: default GITHUB_TOKEN\nwhy: read package.json"]:::pre
    end

    subgraph During["GitHub Releases API"]
        a1["GET /repos/(repo)/releases\nauth: GITHUB_TOKEN\nwhy: list all releases to find drafts"]:::api
        a2["DELETE /repos/(repo)/releases/(id)\nauth: GITHUB_TOKEN\nwhy: wipe each existing draft"]:::api
        a3["POST /repos/(repo)/releases\nauth: GITHUB_TOKEN\nbody: tag_name, target_commitish main, draft true,\nprerelease (true if -suffix), make_latest (legacy or false),\ngenerate_release_notes true\nwhy: create the new draft and let GitHub generate notes"]:::api
        a4["PATCH /repos/(repo)/releases/(id)\nauth: GITHUB_TOKEN\nbody: tag_name, target_commitish main, body (cleaned)\nwhy: replace auto notes with cleaned version"]:::api
    end

    subgraph Out["Result"]
        o1["one draft release\nlisted under repo Releases tab"]:::out
    end

    p1 --> a1 --> a2 --> a3 --> a4 --> o1
```

Auth note: the workflow uses the default `GITHUB_TOKEN` (not the App bot). Default token is enough because:

- `contents: write` permission is granted at workflow level (line 13).
- The default token can create and modify releases on the same repo.
- No downstream workflow needs to fire here, so the "bot token to trigger cascade" reason does not apply.

The cascade fires later when the **human** publishes the draft.

[Back to top](#navigate)

---

## 8. Output cascade

The draft sits idle until a human clicks publish. Publishing is what unlocks the chain.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef wait fill:#9333ea,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000

    CDR["create-draft-release.yml\nrun completes"]:::src
    CDR --> O1["draft release\ntag vX.Y.Z, target main\nbody: cleaned notes"]:::wait

    O1 --> W{publish?}
    W -->|maintainer reviews + clicks Publish| H["release: published event"]:::human
    W -->|sits as draft| WAIT["no cascade until published"]:::wait

    H --> C1["publish-release.yml\non release: published\npublishes to npm"]:::cons
    H --> C2["deploy-docs.yml\non release: published\ndeploys site"]:::cons
    H --> C3["cache-cleanup.yml\non release: published\nclears stale caches"]:::cons
    H --> C4["draft-main-pr.yml\non release: published\nopens next development to main PR"]:::cons

    C1 --> U1[("package on npm")]
    C2 --> U2[("docs site updated")]
    C3 --> U3[("Actions caches pruned")]
    C4 --> U4[("next release cycle staged")]
```

The draft is the **commit point**. Everything before it is automatic and reversible (delete the draft, re-run). Everything after the human clicks publish is permanent.

[Back to top](#navigate)

---

## 9. State machine

A single run as a finite state machine.

```mermaid
stateDiagram-v2
    [*] --> Queued: event arrives
    Queued --> IfChecking: runner picks up job
    IfChecking --> Skipped: PR closed unmerged
    IfChecking --> Starting: merged or dispatch
    Starting --> CheckedOut: actions/checkout
    CheckedOut --> ListedDrafts: GET /releases + jq
    ListedDrafts --> DeletedDrafts: loop DELETE (no-op if list empty)
    DeletedDrafts --> VersionComputed: jq + regex on package.json
    VersionComputed --> InvalidVersion: regex fails (exit 1)
    VersionComputed --> DraftCreated: POST /releases succeeds
    VersionComputed --> CreateFailed: POST /releases fails (exit 1)
    DraftCreated --> NotesCleaned: sed pipeline runs
    NotesCleaned --> PatchSucceeded: PATCH 200
    NotesCleaned --> PatchWarned: PATCH non-200 (warning only)
    PatchSucceeded --> [*]
    PatchWarned --> [*]
    InvalidVersion --> [*]
    CreateFailed --> [*]
    Skipped --> [*]
```

Note the asymmetry: `POST` failure exits the run, but `PATCH` failure only logs a warning. The reasoning is in the next section.

[Back to top](#navigate)

---

## 10. Failure modes

Where things break, what happens, what to do.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["No existing drafts to delete"]:::fail
    F1 --> F1E["release_ids.txt is empty\nwhile loop body never runs"]:::effect
    F1E --> F1X["expected on a clean repo or after manual cleanup, not a failure"]:::fix

    F2["package.json version missing or malformed"]:::fail
    F2 --> F2E["empty version exits 1 with explicit error\nregex (MAJOR.MINOR.PATCH with optional -PRERELEASE)\nfails for non-semver, exit 1"]:::effect
    F2X["fix package.json and re-run via workflow_dispatch"]:::fix
    F2E --> F2X

    F3["POST /releases fails\n(rate limit, tag conflict, permission)"]:::fail
    F3 --> F3E["response lacks .id\nstep prints error JSON and exit 1\nno draft created"]:::effect
    F3X["check token scopes, check tag uniqueness, re-run dispatch"]:::fix
    F3E --> F3X

    F4["PATCH /releases fails"]:::fail
    F4 --> F4E["warning logged, run still succeeds\ndraft exists but with raw auto notes"]:::effect
    F4X["maintainer edits notes by hand in UI before publishing\nor re-runs workflow_dispatch"]:::fix
    F4E --> F4X

    F5["Tag vX.Y.Z already exists as published release"]:::fail
    F5 --> F5E["POST returns 422 validation error\nstep exits 1 at F3 path"]:::effect
    F5X["bump version in package.json on dev branch\nmerge that to main, rerun"]:::fix
    F5E --> F5X

    F6["Two runs overlap (merge plus dispatch)"]:::fail
    F6 --> F6E["no concurrency group set\nboth runs proceed\nlater run wipes earlier draft\nfinal state still has one draft"]:::effect
    F6X["idempotent by design, no action needed"]:::fix
    F6E --> F6X

    F7["GITHUB_TOKEN lacks contents: write"]:::fail
    F7 --> F7E["DELETE or POST returns 403"]:::effect
    F7X["confirm permissions block at workflow level\nor repo-level token policy"]:::fix
    F7E --> F7X
```

The PATCH-is-non-fatal choice is deliberate: a draft with unclean notes is still useful (maintainer can edit in the UI), while a missing draft is not. Better to ship the draft than block on cosmetics.

[Back to top](#navigate)

---

## 11. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/create-draft-release.yml"]:::v
    K2["Triggers"]:::k --- V2["pull_request closed to main (merged) + workflow_dispatch"]:::v
    K3["Job count"]:::k --- V3["1 (update-draft-releases)"]:::v
    K4["Auth"]:::k --- V4["default GITHUB_TOKEN"]:::v
    K5["Permissions"]:::k --- V5["contents: write, id-token: write"]:::v
    K6["Runner"]:::k --- V6["ubuntu-latest"]:::v
    K7["Step count"]:::k --- V7["6 (after checkout)"]:::v
    K8["Version source"]:::k --- V8["package.json .version, formatted as vMAJOR.MINOR.PATCH (preserves -PRERELEASE suffix)"]:::v
    K9["Notes source"]:::k --- V9["GitHub auto-generate (POST generate_release_notes: true)"]:::v
    K10["Lines dropped"]:::k --- V10["chore: bump version, Draft PR for release, Bump Version on PR to Main, docs: sync"]:::v
    K11["Pattern stripped"]:::k --- V11["' by @user in' segments inline"]:::v
    K12["Invariant"]:::k --- V12["exactly one draft release after success"]:::v
    K13["Target commitish"]:::k --- V13["main"]:::v
    K13b["Pre-release flag"]:::k --- V13b["prerelease true when version has -suffix; make_latest=false for prereleases, legacy for stable"]:::v
    K14["Idempotent"]:::k --- V14["yes (wipe-and-recreate is safe to repeat)"]:::v
    K15["Cascade trigger"]:::k --- V15["maintainer clicks Publish, fires release: published"]:::v
    K16["Concurrency"]:::k --- V16["none declared (idempotency relied on instead)"]:::v
```

Direct links:

- Workflow file: [.github/workflows/create-draft-release.yml](../workflows/create-draft-release.yml)
- Downstream on publish: [publish-release.yml](../workflows/publish-release.yml), [deploy-docs.yml](../workflows/deploy-docs.yml), [cache-cleanup.yml](../workflows/cache-cleanup.yml), [draft-main-pr.yml](../workflows/draft-main-pr.yml)
- Version source: [package.json](../../package.json)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)

[Back to top](#navigate)
