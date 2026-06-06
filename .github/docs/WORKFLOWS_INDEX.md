# Workflow Deep Dives Index

One deep-dive document per workflow. Pick any tile to jump in.

Companion docs:
- [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md) - the macro view, all 16 workflows in one document
- [.github/workflows/](../workflows/) - the actual workflow YAML files

## Map of the territory

```mermaid
flowchart LR
    classDef agent fill:#1e3a8a,color:#fff,stroke:#000
    classDef rel fill:#581c87,color:#fff,stroke:#000
    classDef hyg fill:#064e3b,color:#fff,stroke:#000

    subgraph Agents["Agent workflows (LLM-driven)"]
        A1["agent-run"]:::agent
        A2["coder-run"]:::agent
        A3["personas-run"]:::agent
        A4["agent-review-pr"]:::agent
        A5["agent-digest"]:::agent
        A6["bot-respond"]:::agent
        A7["docs-sync"]:::agent
        A8["vitals"]:::agent
    end

    subgraph Release["Release pipeline"]
        R1["draft-main-pr"]:::rel
        R2["check-semantic-versioning"]:::rel
        R3["auto-merge-main-pr"]:::rel
        R4["create-draft-release"]:::rel
        R5["publish-release"]:::rel
        R6["deploy-docs"]:::rel
    end

    subgraph Hygiene["CI hygiene"]
        H1["tests"]:::hyg
        H2["test-package"]:::hyg
        H3["pack-package"]:::hyg
        H4["cache-cleanup"]:::hyg
        H5["update-prs-with-development"]:::hyg
        H6["test-github-action"]:::hyg
    end

    A1 -- opens PR --> A4
    A1 -- files issues --> A2
    A2 -- opens PR --> A4
    A3 -- files issues --> A2
    A4 -- PR merges --> R1
    A5 -- reads logs --> A1
    A5 -- reads logs --> A2
    A5 -- reads logs --> A3
    A4 -- triggers --> H1
    A1 -- workflow changes --> A7
    A2 -- workflow changes --> A7
    A7 -- doc PR --> A4
    R1 -- maintainer marks ready --> R2
    R2 -- success triggers --> R3
    R3 -- merge to main --> R4
    R4 -- maintainer publishes --> R5
    R4 -- maintainer publishes --> R6
    R3 -- triggers --> H4
    R5 -- triggers --> H4
    A2 -- PR closed --> H3
    A1 -- PR closed --> H3
    H5 -- rebases --> A4
```

---

## Agent workflows

| Workflow | Triggers | Purpose | Deep dive |
|----------|----------|---------|-----------|
| [agent-run.yml](../workflows/agent-run.yml) | 3 crons + dispatch | Task agents (docs, tester, scout) on a schedule | [AGENT_RUN_DEEP_DIVE.md](AGENT_RUN_DEEP_DIVE.md) |
| [coder-run.yml](../workflows/coder-run.yml) | cron + dispatch | Fans the coder out across up to 5 unclaimed issues in a matrix | [CODER_RUN_DEEP_DIVE.md](CODER_RUN_DEEP_DIVE.md) |
| [personas-run.yml](../workflows/personas-run.yml) | Sunday cron + dispatch | Persona agents (beginner, harsh-critic, speed-runner, enterprise) plus curator | [PERSONAS_RUN_DEEP_DIVE.md](PERSONAS_RUN_DEEP_DIVE.md) |
| [agent-review-pr.yml](../workflows/agent-review-pr.yml) | PR opened/synchronize on development + workflow_dispatch | Tests (Node matrix) + reviewer agent + decide job: approve, request changes, or close | [AGENT_REVIEW_PR_DEEP_DIVE.md](AGENT_REVIEW_PR_DEEP_DIVE.md) |
| [agent-digest.yml](../workflows/agent-digest.yml) | Monday cron + dispatch | Weekly HTML email digest sent via Microsoft Graph | [AGENT_DIGEST_DEEP_DIVE.md](AGENT_DIGEST_DEEP_DIVE.md) |
| [bot-respond.yml](../workflows/bot-respond.yml) | issue_comment mentioning @llm-exe-bot | Conversational responder; can dispatch review pipeline, answer questions, or revise PR branches on explicit ask | [BOT_RESPOND_DEEP_DIVE.md](BOT_RESPOND_DEEP_DIVE.md) |
| [docs-sync.yml](../workflows/docs-sync.yml) | push to development on workflow/script/action changes + dispatch | Keeps the workflow deep-dive docs in sync with their source files | [DOCS_SYNC_DEEP_DIVE.md](DOCS_SYNC_DEEP_DIVE.md) |
| [vitals.yml](../workflows/vitals.yml) | daily cron + dispatch | Regenerates [AUTOMATION.md](../../AUTOMATION.md), the live dashboard at the repo root | [VITALS_DEEP_DIVE.md](VITALS_DEEP_DIVE.md) |

## Release pipeline

| Workflow | Triggers | Purpose | Deep dive |
|----------|----------|---------|-----------|
| [draft-main-pr.yml](../workflows/draft-main-pr.yml) | PR closed to development + release published | Maintains the development to main draft PR; auto-bumps patch on stable versions, skips auto-bump entirely on pre-release versions (-beta.X, -rc.X, ...) | [DRAFT_MAIN_PR_DEEP_DIVE.md](DRAFT_MAIN_PR_DEEP_DIVE.md) |
| [check-semantic-versioning.yml](../workflows/check-semantic-versioning.yml) | PR on main | Blocks PR if package.json version is not greater than latest tag | [CHECK_SEMVER_DEEP_DIVE.md](CHECK_SEMVER_DEEP_DIVE.md) |
| [auto-merge-main-pr.yml](../workflows/auto-merge-main-pr.yml) | workflow_run on semver-check + PR events | Waits for checks, merges development to main with --admin | [AUTO_MERGE_MAIN_PR_DEEP_DIVE.md](AUTO_MERGE_MAIN_PR_DEEP_DIVE.md) |
| [create-draft-release.yml](../workflows/create-draft-release.yml) | PR merged to main + dispatch | Wipes existing drafts and creates a fresh draft release with cleaned notes; marks GitHub release as `prerelease` (and skips `make_latest`) when package.json version has a -suffix | [CREATE_DRAFT_RELEASE_DEEP_DIVE.md](CREATE_DRAFT_RELEASE_DEEP_DIVE.md) |
| [publish-release.yml](../workflows/publish-release.yml) | release published + dispatch | npm publish: stable to `latest`, pre-releases with alphabetic channel routed to `--tag $CHANNEL` (beta, rc, alpha, ...); failure rolls release back to draft | [PUBLISH_RELEASE_DEEP_DIVE.md](PUBLISH_RELEASE_DEEP_DIVE.md) |
| [deploy-docs.yml](../workflows/deploy-docs.yml) | release published + dispatch | Builds VitePress docs, ships to S3, rotates CloudFront OriginPath, invalidates | [DEPLOY_DOCS_DEEP_DIVE.md](DEPLOY_DOCS_DEEP_DIVE.md) |

## CI hygiene

| Workflow | Triggers | Purpose | Deep dive |
|----------|----------|---------|-----------|
| [tests.yml](../workflows/tests.yml) | PR on main + push to main + dispatch | Jest matrix on Node 18/20/22/24; coverage uploaded on Node 24 | [TESTS_DEEP_DIVE.md](TESTS_DEEP_DIVE.md) |
| [test-package.yml](../workflows/test-package.yml) | Dispatch only (gregreindel) | Runs examples/ against a packed tarball with real provider keys | [TEST_PACKAGE_DEEP_DIVE.md](TEST_PACKAGE_DEEP_DIVE.md) |
| [pack-package.yml](../workflows/pack-package.yml) | PR closed to development + dispatch | Build + npm pack, uploads .tgz artifact (30-day retention) | [PACK_PACKAGE_DEEP_DIVE.md](PACK_PACKAGE_DEEP_DIVE.md) |
| [cache-cleanup.yml](../workflows/cache-cleanup.yml) | PR closed + release published + dispatch | Deletes Actions caches scoped to the closed PR or release ref | [CACHE_CLEANUP_DEEP_DIVE.md](CACHE_CLEANUP_DEEP_DIVE.md) |
| [update-prs-with-development.yml](../workflows/update-prs-with-development.yml) | Dispatch only | Rebases every non-draft open PR targeting development | [UPDATE_PRS_DEEP_DIVE.md](UPDATE_PRS_DEEP_DIVE.md) |
| [test-github-action.yml](../workflows/test-github-action.yml) | Dispatch only | Smoke-tests the external llm-exe/github-action with a real LLM call | [TEST_GITHUB_ACTION_DEEP_DIVE.md](TEST_GITHUB_ACTION_DEEP_DIVE.md) |

---

## At a glance

```mermaid
flowchart LR
    classDef sm fill:#374151,color:#fff,stroke:#000
    classDef md fill:#1e3a8a,color:#fff,stroke:#000
    classDef lg fill:#581c87,color:#fff,stroke:#000

    subgraph Small["5-8 diagrams"]
        S1["pack-package: 356 lines, 8"]:::sm
        S2["tests: 377 lines, 9"]:::sm
        S3["update-prs: 367 lines, 9"]:::sm
        S4["check-semver: 383 lines, 9"]:::sm
        S5["test-github-action: 7 diagrams"]:::sm
    end

    subgraph Medium["11-12 diagrams"]
        M1["agent-review-pr: 566 lines, 12"]:::md
        M2["cache-cleanup: 548 lines, 12"]:::md
        M3["create-draft-release: 489 lines, 11"]:::md
        M4["personas-run: 709 lines, 12"]:::md
        M5["publish-release: 522 lines, 12"]:::md
        M6["test-package: 551 lines, 11"]:::md
    end

    subgraph Large["13 diagrams"]
        L1["agent-run: 653 lines, 13"]:::lg
        L2["coder-run: 736 lines, 13"]:::lg
        L3["draft-main-pr: 663 lines, 13"]:::lg
        L4["deploy-docs: 579 lines, 13"]:::lg
        L5["bot-respond: 581 lines, 13"]:::lg
        L6["agent-digest: 591 lines, 13"]:::lg
        L7["auto-merge-main-pr: 567 lines, 13"]:::lg
    end
```

Totals: 20 deep dives.

## Conventions every deep dive follows

- Top section is "Navigate" with anchor links to every section
- Each section ends with "[Back to top](#navigate)" so you can jump back
- "The whole picture" is always section 1: one flowchart that shows the workflow in context
- "Quick reference card" is always the last section: a key/value lookup of every constant
- Mermaid diagrams use a consistent color palette (blue for jobs, purple for outputs, green for externals, gray for files, dark red for gates/failures)
- No em dashes anywhere
- File paths are clickable markdown links

## How to use this index

| If you want to... | Start here |
|-------------------|-----------|
| Understand one workflow end to end | the deep dive for that workflow |
| Understand how workflows interact | [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md) |
| Trace a feature from idea to npm | [WORKFLOW_ARCHITECTURE.md sections 11 and 12](WORKFLOW_ARCHITECTURE.md) |
| Replicate this automation in another repo | [WORKFLOW_ARCHITECTURE.md section 13 (Replication Recipe)](WORKFLOW_ARCHITECTURE.md) |
| Triage a failing run | the "Failure modes" section of the relevant deep dive |
| Audit secrets and identities | [WORKFLOW_ARCHITECTURE.md section 5](WORKFLOW_ARCHITECTURE.md) |
