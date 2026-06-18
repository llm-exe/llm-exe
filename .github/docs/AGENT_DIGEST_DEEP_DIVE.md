# agent-digest: Visual Deep Dive

Concentrated diagrams for [.github/workflows/agent-digest.yml](../workflows/agent-digest.yml). Companion to [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md) and [AGENT_RUN_DEEP_DIVE.md](AGENT_RUN_DEEP_DIVE.md).

This workflow turns a week of GitHub activity and agent logs into an HTML email that lands in maintainer inboxes every Monday morning. Two steps: Claude writes the body, bash sends it through Microsoft Graph.

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers](#2-triggers)
- [3. The two-step DAG](#3-the-two-step-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. Data sources Claude reads](#5-data-sources-claude-reads)
- [6. The digest section structure](#6-the-digest-section-structure)
- [7. External calls](#7-external-calls)
- [8. The Azure OAuth dance](#8-the-azure-oauth-dance)
- [9. The Microsoft Graph sendMail payload shape](#9-the-microsoft-graph-sendmail-payload-shape)
- [10. Output cascade](#10-output-cascade)
- [11. State machine](#11-state-machine)
- [12. Failure modes](#12-failure-modes)
- [13. Quick reference card](#13-quick-reference-card)

---

## 1. The whole picture

How [agent-digest.yml](../workflows/agent-digest.yml) sits between GitHub data, Claude inference, and Microsoft Graph email delivery.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        c1["cron 0 11 * * 1\n(Monday 11am UTC)"]:::trig
        d1["workflow_dispatch\n(manual run)"]:::trig
    end

    subgraph A["agent-digest.yml"]
        J["digest job\ntimeout 10m"]:::job
        S1["step: Generate digest\nclaude-code-action@v1"]:::job
        S2["step: Get access token\nAzure OAuth"]:::job
        S3["step: Send digest email\nMS Graph POST"]:::job
        J --> S1 --> S2 --> S3
    end

    subgraph SEC["Secrets"]
        s1["APP_ID + APP_PRIVATE_KEY"]:::file
        s2["CLAUDE_CODE_OAUTH_TOKEN"]:::file
        s3["AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET"]:::file
        s4["SMTP_USERNAME (sender mailbox)"]:::file
        s5["MARKETING_EMAILS (CSV recipients)"]:::file
    end

    subgraph F["Files read"]
        gi["gh issue list\n(7 days)"]:::file
        gp["gh pr list\n(20 most recent)"]:::file
        gr["gh release list\n(3 most recent)"]:::file
        lg["scripts/agents/logs/(role)/*.md\n(past week)"]:::file
    end

    subgraph TMP["Ephemeral"]
        h["/tmp/digest.html\nHTML body only"]:::file
    end

    subgraph X["External services"]
        gh["api.github.com\nvia gh CLI"]:::ext
        ant["api.anthropic.com\nclaude-sonnet-4-6"]:::ext
        az["login.microsoftonline.com\nOAuth token endpoint"]:::ext
        msg["graph.microsoft.com\nsendMail endpoint"]:::ext
    end

    subgraph O["Outputs"]
        mail["Email in MARKETING_EMAILS\ninboxes"]:::out
    end

    c1 --> J
    d1 --> J
    s1 --> S1
    s2 --> S1
    s3 --> S2
    s4 --> S3
    s5 --> S3
    S1 --> gh
    gh --> gi
    gh --> gp
    gh --> gr
    S1 --> lg
    S1 --> ant
    ant --> h
    S2 --> az
    S3 --> h
    S3 --> msg
    msg --> mail
```

[Back to top](#navigate)

---

## 2. Triggers

Two ways the digest fires. One on the clock, one on demand.

```mermaid
flowchart TB
    classDef cron fill:#0e7490,color:#fff,stroke:#000
    classDef manual fill:#9333ea,color:#fff,stroke:#000
    classDef out fill:#1f2937,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|schedule| sch["cron string\n0 11 * * 1\n(Monday 11:00 UTC)"]:::cron
    ev -->|workflow_dispatch| disp["manual trigger\n(no inputs)"]:::manual

    sch --> proceed[(run digest job)]:::out
    disp --> proceed

    proceed --> note["No gate, no backlog check\nDigest is read-only on the repo"]:::out
```

Why no gate: this workflow reads GitHub data and agent logs, writes a single ephemeral file, then sends an email. It produces zero PRs, zero issues, zero commits. There is nothing to back up.

[Back to top](#navigate)

---

## 3. The two-step DAG

One job, three sequential steps after token mint and checkout. Claude generates, bash sends.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef llm fill:#581c87,color:#fff,stroke:#000
    classDef http fill:#0e7490,color:#fff,stroke:#000

    start([Workflow event])
    start --> J1

    subgraph J1["Job: digest (ubuntu-latest, timeout-minutes: 10)"]
        direction TB
        s1["Generate bot token\ncreate-github-app-token@v3"]:::step
        s2["Checkout\nactions/checkout@v6"]:::step
        s3["Generate digest\nclaude-code-action@v1\nmodel: claude-sonnet-4-6\nmax-turns: 15"]:::llm
        s4["Get access token\ncurl POST to Azure OAuth"]:::http
        s5["Send digest email\ncurl POST to MS Graph"]:::http
        s1 --> s2 --> s3 --> s4 --> s5
    end
```

Step 3 writes `/tmp/digest.html`. Step 5 reads it. The handoff is a file on the runner, not an output variable.

No `if: always()` on later steps. If Claude fails to produce `/tmp/digest.html`, the email step still runs but curls a missing file and the API call fails. That is acceptable: no partial digest is better than a misleading one.

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

One run from event to delivered email. Three external services chained.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event (cron or dispatch)
    participant J as digest job
    participant T as Token mint
    participant GH as GitHub API (via gh CLI)
    participant FS as Repo filesystem
    participant CCA as claude-code-action (v1)
    participant ANT as Anthropic API
    participant TMP as /tmp/digest.html
    participant AZ as Azure OAuth (login.microsoftonline.com)
    participant MG as Microsoft Graph (graph.microsoft.com)
    participant IN as Recipient inboxes

    E->>J: trigger workflow
    J->>T: create-github-app-token (APP_ID + key)
    T-->>J: short-lived bot token
    J->>FS: actions/checkout@v6 with bot token
    J->>CCA: prompt + allowedTools + max-turns 15
    CCA->>GH: gh issue list (state all, since 7 days ago)
    GH-->>CCA: issue JSON
    CCA->>GH: gh pr list (state all, limit 20)
    GH-->>CCA: PR JSON
    CCA->>FS: read scripts/agents/logs/(role)/*.md (past week)
    FS-->>CCA: log markdown
    CCA->>GH: gh release list (limit 3)
    GH-->>CCA: release JSON
    CCA->>ANT: streaming inference (claude-sonnet-4-6)
    ANT-->>CCA: HTML body content
    CCA->>TMP: Write /tmp/digest.html
    J->>AZ: POST oauth2/v2.0/token (client_credentials)
    AZ-->>J: access_token (Graph scope)
    J->>TMP: read /tmp/digest.html, jq -Rs encode
    J->>MG: POST users/(sender)/sendMail with bearer + JSON body
    MG-->>J: 202 Accepted
    MG->>IN: deliver email to MARKETING_EMAILS list
```

Source: [.github/workflows/agent-digest.yml](../workflows/agent-digest.yml) lines 19-102.

[Back to top](#navigate)

---

## 5. Data sources Claude reads

Four data wells. Each one answers a different question in the digest.

```mermaid
flowchart LR
    classDef gh fill:#1f2937,color:#fff,stroke:#000
    classDef fs fill:#0e7490,color:#fff,stroke:#000
    classDef sec fill:#7c2d12,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph Sources
        d1["gh issue list\n--state all\n--since 7 days ago\n--limit 50"]:::gh
        d2["gh pr list\n--state all\n--limit 20"]:::gh
        d3["gh release list\n--limit 3"]:::gh
        d4["scripts/agents/logs/(role)/*.md\nfrom past week\n(coder, docs, tester, scout, curator, personas, reviewer)"]:::fs
    end

    subgraph Auth
        a1["bot token\n(github_token input)"]:::sec
        a2["repo working tree\n(checkout)"]:::sec
    end

    subgraph Question["What each source answers"]
        q1["What got filed?\n(Issues filed section)"]:::out
        q2["What is merged / waiting?\n(What shipped + Open PRs)"]:::out
        q3["What got cut?\n(What shipped releases)"]:::out
        q4["What did each agent do?\n(Agent activity section)"]:::out
    end

    a1 --> d1
    a1 --> d2
    a1 --> d3
    a2 --> d4

    d1 --> q1
    d2 --> q2
    d3 --> q3
    d4 --> q4
```

The log files are committed markdown, not artifacts. They survive past the 90-day artifact retention so the digest can read them indefinitely. See [WORKFLOW_ARCHITECTURE.md Appendix C item 3](WORKFLOW_ARCHITECTURE.md) for why logs are git-tracked.

[Back to top](#navigate)

---

## 6. The digest section structure

The prompt mandates five sections. Each maps to one or more data sources.

```mermaid
flowchart TB
    classDef sec fill:#1e3a8a,color:#fff,stroke:#000
    classDef src fill:#064e3b,color:#fff,stroke:#000
    classDef rule fill:#7c2d12,color:#fff,stroke:#000

    H["/tmp/digest.html\nHTML body, no html/body tags"]:::sec

    H --> S1["What shipped\nPRs merged + releases cut"]:::sec
    H --> S2["Open PRs\nwaiting for review"]:::sec
    H --> S3["Issues filed\nbugs, enhancements, breaking"]:::sec
    H --> S4["Agent activity\nper-agent summary"]:::sec
    H --> S5["Needs attention\nurgent, blocked, stale"]:::sec

    S1 --> D1["gh pr list (merged subset)\n+ gh release list"]:::src
    S2 --> D2["gh pr list (open subset)"]:::src
    S3 --> D3["gh issue list (since 7d)"]:::src
    S4 --> D4["scripts/agents/logs/(role)/*.md"]:::src
    S5 --> D5["cross-cut: stale PRs +\nold open issues +\ninterrupted agent runs"]:::src

    R["Style rules\n- short, scannable\n- bullet points\n- full GitHub URLs for links"]:::rule
    H --> R
```

Why HTML body only (no html/body wrapper): Microsoft Graph wraps the content as a complete MIME message itself. Sending a full HTML document inside that would nest two documents and many mail clients render that incorrectly.

[Back to top](#navigate)

---

## 7. External calls

Three different external services, three different credentials, three different reasons.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef llm fill:#581c87,color:#fff,stroke:#000
    classDef gh fill:#1f2937,color:#fff,stroke:#000
    classDef az fill:#0b3954,color:#fff,stroke:#000
    classDef mg fill:#064e3b,color:#fff,stroke:#000

    subgraph Pre["Setup"]
        c1["create-github-app-token@v3\nauth: APP_ID + APP_PRIVATE_KEY\nwhy: bot token for gh CLI in step 3"]:::pre
        c2["actions/checkout@v6\nauth: bot token\nwhy: get repo so Claude can read logs"]:::pre
    end

    subgraph During["Digest generation"]
        d1["api.anthropic.com\nauth: CLAUDE_CODE_OAUTH_TOKEN\nwhy: inference (claude-sonnet-4-6)\ncost meter: --max-turns 15"]:::llm
        d2["api.github.com (gh CLI)\nauth: bot token\nwhy: list issues, PRs, releases"]:::gh
    end

    subgraph Send["Email delivery"]
        e1["login.microsoftonline.com\n/(tenant)/oauth2/v2.0/token\nauth: client_credentials\nwhy: get Graph access token"]:::az
        e2["graph.microsoft.com\n/v1.0/users/(sender)/sendMail\nauth: Bearer (Graph token)\nwhy: send HTML email"]:::mg
    end

    c1 --> c2
    c2 --> d1
    d1 --> d2
    d2 --> e1
    e1 --> e2
```

Tool allowlist passed to `claude-code-action@v1`:

```
--allowedTools "Bash,Read,Glob,Grep,Write"
--max-turns 15
--model claude-sonnet-4-6
```

Notice the differences from `agent-run.yml`:

| Property | agent-run | agent-digest |
|----------|-----------|--------------|
| Model | claude-opus-4-6 | claude-sonnet-4-6 |
| Max turns | 50 | 15 |
| Tools | Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch | Bash, Read, Glob, Grep, Write |
| Edit allowed? | yes | no |
| Web allowed? | yes | no |

Sonnet is cheaper, the work is summarization not invention, and 15 turns is plenty for read-fetch-write. No Edit because Claude writes one fresh file. No Web because all data is local or via gh CLI.

[Back to top](#navigate)

---

## 8. The Azure OAuth dance

Client credentials grant. No user, no consent prompt, no refresh token. Designed for headless service-to-service.

```mermaid
sequenceDiagram
    autonumber
    participant J as digest job (curl)
    participant AZ as login.microsoftonline.com
    participant MG as Microsoft Graph
    participant JQ as jq

    J->>AZ: POST /(AZURE_TENANT_ID)/oauth2/v2.0/token
    Note over J,AZ: form body: client_id, client_secret, scope=https graph default, grant_type=client_credentials
    AZ->>AZ: validate client_id + client_secret\nagainst app registration in tenant
    AZ->>AZ: check app has Mail.Send (application) permission\nadmin-consented
    AZ-->>J: 200 OK with JSON { access_token, expires_in, ... }
    J->>JQ: pipe through jq -r .access_token
    JQ-->>J: bare token string
    J->>J: echo ::add-mask to scrub logs
    J->>J: echo token=... to GITHUB_OUTPUT
    Note over J: token is now available as steps.auth.outputs.token\nfor the next step
    J->>MG: subsequent POST uses Authorization Bearer (token)
```

The `::add-mask::` workflow command tells Actions to scrub any future occurrence of the token from logs. Without it the next step's curl could echo the bearer header into the workflow log.

Scope `https://graph.microsoft.com/.default` means "all permissions the app registration was granted." Concretely that should be `Mail.Send` (application). Anything more is over-privileged.

[Back to top](#navigate)

---

## 9. The Microsoft Graph sendMail payload shape

How the HTML body and recipient list get marshalled into the Graph request.

```mermaid
flowchart TB
    classDef in fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph Inputs
        I1["/tmp/digest.html\n(HTML body)"]:::in
        I2["MARKETING_EMAILS\nCSV string\n'alice@x.com, bob@y.com'"]:::in
        I3["SMTP_USERNAME\nsender mailbox UPN"]:::in
        I4["steps.auth.outputs.token\nGraph bearer"]:::in
    end

    subgraph Build["Bash assembly"]
        B1["BODY=cat /tmp/digest.html pipe jq -Rs .\n(JSON-encodes HTML as a quoted string)"]:::step
        B2["IFS=',' read into EMAILS array"]:::step
        B3["for each email: xargs trim,\nappend {emailAddress address email}\nto TO_RECIPIENTS"]:::step
    end

    subgraph Request["POST graph.microsoft.com /v1.0/users/(sender)/sendMail"]
        R1["headers:\nAuthorization Bearer (token)\nContent-Type application/json"]:::out
        R2["body JSON:\n{ message: {\n  subject: 'llm-exe weekly digest - (Mon DD)',\n  body: { contentType: HTML, content: (BODY) },\n  toRecipients: [(TO_RECIPIENTS array)]\n}}"]:::out
    end

    I1 --> B1 --> R2
    I2 --> B2 --> B3 --> R2
    I3 --> R1
    I3 --> R2
    I4 --> R1
```

Why `jq -Rs .` on the body: `-R` reads raw input (no JSON parsing), `-s` slurps the whole file into one string, `.` echoes it. Net effect: the entire HTML file becomes a single JSON-quoted string with all quotes, backslashes, and newlines properly escaped. Without this, any double-quote in the HTML would break the outer JSON.

Why `xargs` to trim each email: bash splits the CSV on commas but leaves leading and trailing whitespace. `echo "$email" | xargs` strips it. Without this, `"  bob@y.com"` becomes a recipient with a literal leading space and Graph rejects it.

The `toRecipients` field is an array, not a string. Each element is an object: `{"emailAddress": {"address": "user@example.com"}}`. The bash loop builds the comma-joined inner content, then `[${TO_RECIPIENTS}]` wraps it as a JSON array.

[Back to top](#navigate)

---

## 10. Output cascade

What the digest produces and where it ends up.

```mermaid
flowchart LR
    classDef src fill:#1e3a8a,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000
    classDef cons fill:#064e3b,color:#fff,stroke:#000
    classDef human fill:#7c2d12,color:#fff,stroke:#000

    AD["agent-digest.yml\nrun completes"]:::src

    AD --> O1["/tmp/digest.html\nephemeral, dies with runner"]:::out
    AD --> O2["Microsoft Graph sendMail call\n202 Accepted"]:::out

    O1 --> X[("discarded with runner VM\nno artifact upload")]
    O2 --> C1["MS Exchange Online\nrouting + spam filter"]:::cons
    C1 --> C2["MARKETING_EMAILS inboxes\n(one mail per recipient)"]:::cons
    C2 --> H1["maintainer reads digest\nSunday/Monday morning"]:::human
    H1 --> H2{action?}
    H2 -->|review open PR| PR[("clicks PR link from email")]
    H2 -->|triage filed issue| ISS[("clicks issue link")]
    H2 -->|noop| done([archive])
```

Unlike `agent-run.yml`, this workflow writes nothing to git. The only persistent artifact is the email itself, sitting in recipient mailboxes. There is no log of what the digest contained beyond what each recipient keeps.

If you want the digest history, archive the inbox. The workflow does not.

[Back to top](#navigate)

---

## 11. State machine

A single digest run as a finite state machine.

```mermaid
stateDiagram-v2
    [*] --> Queued: cron or dispatch
    Queued --> Booting: runner picks up job
    Booting --> CheckedOut: bot token + checkout done
    CheckedOut --> Generating: claude-code-action starts
    Generating --> Fetching: gh issue/pr/release calls
    Fetching --> Reading: read scripts/agents/logs/
    Reading --> Inferring: Anthropic streaming inference
    Inferring --> Writing: Claude writes /tmp/digest.html
    Writing --> NoOutput: file missing or empty
    Writing --> AuthRequesting: POST Azure token endpoint
    AuthRequesting --> Authed: 200 with access_token
    AuthRequesting --> AuthFailed: 400/401 from Azure
    Authed --> Sending: POST Graph sendMail
    Sending --> Delivered: 202 Accepted
    Sending --> SendFailed: 4xx/5xx from Graph
    NoOutput --> SendFailed: bash sends empty body
    Generating --> TimedOut: 10-minute job timeout OR max-turns 15
    TimedOut --> [*]
    AuthFailed --> [*]
    SendFailed --> [*]
    Delivered --> [*]
```

No `if: always()` clock-out step, no committed log. A failed run leaves no trace in the repo. Failures are visible only in the GitHub Actions run history.

[Back to top](#navigate)

---

## 12. Failure modes

Where the digest can break and what to do about each.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["Bot token mint fails\nAPP_ID or APP_PRIVATE_KEY wrong"]:::fail
    F1 --> F1E["job fails at step 1\nno email sent"]:::effect
    F1E --> F1X["rotate App key, re-add secret"]:::fix

    F2["Claude action hits --max-turns 15"]:::fail
    F2 --> F2E["may write incomplete /tmp/digest.html\nor not write it at all"]:::effect
    F2E --> F2X["increase max-turns, or simplify prompt\nMS Graph step still runs and may send partial body"]:::fix

    F3["Job exceeds 10-minute timeout"]:::fail
    F3 --> F3E["runner kills the digest step\nlater steps may not run"]:::effect
    F3E --> F3X["dispatch manually after fix\nor wait for next Monday"]:::fix

    F4["Anthropic API outage"]:::fail
    F4 --> F4E["claude-code-action returns error\nno /tmp/digest.html written"]:::effect
    F4E --> F4X["Microsoft Graph step curls a missing file\nsendMail call fails, no email"]:::fix

    F5["Azure token call returns 401\n(bad client_secret or tenant)"]:::fail
    F5 --> F5E["jq parses null access_token\nbearer is the string 'null'\nGraph rejects with 401"]:::effect
    F5E --> F5X["rotate AZURE_CLIENT_SECRET\nverify AZURE_TENANT_ID"]:::fix

    F6["Graph sendMail returns 403\n(app missing Mail.Send permission)"]:::fail
    F6 --> F6E["email never delivered\nno user-visible error"]:::effect
    F6E --> F6X["grant Mail.Send application permission\nin Azure portal, admin-consent"]:::fix

    F7["SMTP_USERNAME mailbox does not exist"]:::fail
    F7 --> F7E["Graph returns 404 on the user path"]:::effect
    F7E --> F7X["set SMTP_USERNAME to a valid licensed mailbox UPN"]:::fix

    F8["MARKETING_EMAILS empty or malformed"]:::fail
    F8 --> F8E["toRecipients array is empty or contains junk\nGraph returns 400"]:::effect
    F8E --> F8X["set MARKETING_EMAILS to comma-separated valid addresses"]:::fix

    F9["Recipient inbox bounces"]:::fail
    F9 --> F9E["Graph still 202s the request\nbounce goes to SMTP_USERNAME"]:::effect
    F9E --> F9X["maintainer prunes bad address from MARKETING_EMAILS"]:::fix
```

The most insidious failure is F5: Azure returns a JSON error body and `jq -r .access_token` outputs the string `null`. The bearer header literally reads `Authorization: Bearer null` and Graph rejects with 401. Watch for this in run logs.

[Back to top](#navigate)

---

## 13. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/agent-digest.yml"]:::v
    K2["Triggers"]:::k --- V2["cron 0 11 * * 1 + workflow_dispatch"]:::v
    K3["Schedule"]:::k --- V3["Monday 11:00 UTC (6am EST)"]:::v
    K4["Permissions"]:::k --- V4["contents/issues/PRs: read, id-token: write"]:::v
    K5["Timeout"]:::k --- V5["10 minutes"]:::v
    K6["Identity"]:::k --- V6["llm-exe-bot[bot] for gh CLI"]:::v
    K7["Model"]:::k --- V7["claude-sonnet-4-6"]:::v
    K8["Max turns"]:::k --- V8["15"]:::v
    K9["Tool allowlist"]:::k --- V9["Bash, Read, Glob, Grep, Write"]:::v
    K10["Edit/Web tools"]:::k --- V10["disabled (no Edit, no WebFetch, no WebSearch)"]:::v
    K11["Output file"]:::k --- V11["/tmp/digest.html (HTML body only)"]:::v
    K12["Sections required"]:::k --- V12["What shipped, Open PRs, Issues filed, Agent activity, Needs attention"]:::v
    K13["Azure auth"]:::k --- V13["client_credentials grant, Graph .default scope"]:::v
    K14["Send endpoint"]:::k --- V14["graph.microsoft.com /v1.0/users/(sender)/sendMail"]:::v
    K15["Sender"]:::k --- V15["SMTP_USERNAME (licensed mailbox UPN)"]:::v
    K16["Recipients"]:::k --- V16["MARKETING_EMAILS (CSV)"]:::v
    K17["Subject"]:::k --- V17["llm-exe weekly digest - (Mon DD)"]:::v
    K18["Persistence"]:::k --- V18["none in repo, lives only in inboxes"]:::v
```

Direct links:

- Workflow file: [.github/workflows/agent-digest.yml](../workflows/agent-digest.yml)
- Companion deep dive: [AGENT_RUN_DEEP_DIVE.md](AGENT_RUN_DEEP_DIVE.md)
- Log directory (digest source): [scripts/agents/logs/](../../scripts/agents/logs/)
- Full architecture doc: [WORKFLOW_ARCHITECTURE.md](WORKFLOW_ARCHITECTURE.md)
- Microsoft Graph sendMail reference: https://learn.microsoft.com/en-us/graph/api/user-sendmail
- Azure client credentials flow: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow

[Back to top](#navigate)
