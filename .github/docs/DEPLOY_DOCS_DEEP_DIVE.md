# deploy-docs: Visual Deep Dive

Concentrated diagrams for [.github/workflows/deploy-docs.yml](../workflows/deploy-docs.yml). This workflow ships the VitePress site to S3 behind CloudFront, using a versioned-folder origin-rotation pattern so the live URL never changes during a release.

Minimum prose. Maximum diagrams.

## Navigate

- [1. The whole picture](#1-the-whole-picture)
- [2. Triggers and branch guards](#2-triggers-and-branch-guards)
- [3. The two-job DAG](#3-the-two-job-dag)
- [4. Step-by-step lifecycle](#4-step-by-step-lifecycle)
- [5. The PACKAGE_ID convention](#5-the-package_id-convention)
- [6. The OIDC federation handshake](#6-the-oidc-federation-handshake)
- [7. The CloudFront origin-rotation pattern](#7-the-cloudfront-origin-rotation-pattern)
- [8. External calls](#8-external-calls)
- [9. Why versioned S3 folders + origin rotation](#9-why-versioned-s3-folders--origin-rotation)
- [10. Output cascade](#10-output-cascade)
- [11. The state machine](#11-the-state-machine)
- [12. Failure modes](#12-failure-modes)
- [13. Quick reference card](#13-quick-reference-card)

---

## 1. The whole picture

How [deploy-docs.yml](../workflows/deploy-docs.yml) plugs into GitHub identity, AWS IAM/STS, S3, and CloudFront.

```mermaid
flowchart LR
    classDef trig fill:#0b3954,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef ext fill:#064e3b,color:#fff,stroke:#000
    classDef file fill:#374151,color:#fff,stroke:#000
    classDef out fill:#581c87,color:#fff,stroke:#000

    subgraph T["Triggers"]
        t1["workflow_dispatch\n(manual)"]:::trig
        t2["release: published\n(automatic on GitHub release)"]:::trig
    end

    subgraph A["deploy-docs.yml"]
        G["check-deploy-branch\nbranch guard"]:::gate
        R["deploy-docs\nbuild + ship"]:::job
    end

    subgraph S["Identity"]
        gt["default GITHUB_TOKEN\n(checkout only)"]:::file
        oidc["GitHub OIDC token\nid-token: write"]:::file
        role["AWS IAM Role\nvars.AWS_ROLE_DEPLOY_ARN"]:::file
    end

    subgraph F["Build inputs and outputs"]
        pj["package.json\n(version)"]:::file
        env["docs/.env\nVITE_PACKAGE_ID=..."]:::file
        vp["docs/.vitepress/dist/\n(VitePress build output)"]:::file
        dst["dist/\n(staged for upload)"]:::file
        art["actions artifact docs\n(30-day retention)"]:::file
    end

    subgraph X["AWS"]
        sts["AWS STS\nAssumeRoleWithWebIdentity"]:::ext
        s3["S3 bucket\nvars.AWS_S3_BUCKET\nprefix docs/(PACKAGE_ID)/"]:::ext
        cf["CloudFront distribution\nvars.AWS_CLOUDFRONT_DISTRIBUTION_ID"]:::ext
    end

    subgraph O["Outputs"]
        live["live docs URL\n(unchanged across deploys)"]:::out
    end

    t1 --> G
    t2 --> G
    G -->|allowed branch| R
    G -.->|wrong branch| stop(["fail"])
    gt --> R
    R --> pj --> env --> vp --> dst --> art
    R --> oidc --> sts --> role
    role --> s3
    role --> cf
    dst --> s3
    s3 --> cf
    cf --> live
```

[Back to top](#navigate)

---

## 2. Triggers and branch guards

Two entry points. Each carries a different branch contract enforced by `check-deploy-branch`.

```mermaid
flowchart TB
    classDef trig fill:#0e7490,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000
    classDef ok fill:#064e3b,color:#fff,stroke:#000
    classDef bad fill:#7f1d1d,color:#fff,stroke:#000

    start([event arrives])
    start --> ev{event_name?}

    ev -->|workflow_dispatch| d1["read GITHUB_REF\nstrip refs/heads/"]:::trig
    ev -->|release.published| r1["jq -r .release.target_commitish\nfrom GITHUB_EVENT_PATH"]:::trig

    d1 --> d2{branch in\n development, main ?}:::gate
    r1 --> r2{target_commitish\n== main ?}:::gate

    d2 -->|yes| go[(proceed to deploy-docs)]:::ok
    d2 -->|no| df([fail: wrong dispatch branch]):::bad

    r2 -->|yes| go
    r2 -->|no| rf([fail: release not from main]):::bad
```

Source: [.github/workflows/deploy-docs.yml](../workflows/deploy-docs.yml) lines 14-34.

[Back to top](#navigate)

---

## 3. The two-job DAG

A guard job and the real work, wired with `needs:`.

```mermaid
flowchart TB
    classDef job fill:#1e3a8a,color:#fff,stroke:#000
    classDef step fill:#374151,color:#fff,stroke:#000
    classDef gate fill:#7c2d12,color:#fff,stroke:#000

    start([Workflow event])
    start --> J1

    subgraph J1["Job: check-deploy-branch (ubuntu-latest)"]
        direction TB
        g1["Step: release branch check\n(only if release.published)"]:::gate
        g2["Step: dispatch branch check\n(only if workflow_dispatch)"]:::gate
        g1 --> g2
    end

    J1 -->|exit 0| dec{both guards passed?}
    dec -->|no| stop([job failed, deploy-docs skipped])
    dec -->|yes| J2

    subgraph J2["Job: deploy-docs (ubuntu-latest, needs: check-deploy-branch)"]
        direction TB
        s1["checkout@v4 (default GITHUB_TOKEN)"]:::step
        s2["./.github/actions/setup-node (Node 24.x)"]:::step
        s3["./.github/actions/cache (node_modules)"]:::step
        s4["npm install"]:::step
        s5["read package.json version"]:::step
        s6["compute PACKAGE_ID = version-timestamp"]:::step
        s7["write docs/.env (VITE_PACKAGE_ID)"]:::step
        s8["npm run docs:update-providers\nnpm run docs:build"]:::step
        s9["upload-artifact@v4 name=docs"]:::step
        s10["configure-aws-credentials@v4 (OIDC)"]:::step
        s11["aws sts get-caller-identity"]:::step
        s12["stage dist/ (copy build + package.json)"]:::step
        s13["aws s3 cp dist s3://.../docs/(PACKAGE_ID)/"]:::step
        s14["aws cloudfront get-distribution-config"]:::step
        s15["extract ETag + DistributionConfig"]:::step
        s16["jq mutate OriginPath = /docs/(PACKAGE_ID)"]:::step
        s17["aws cloudfront update-distribution --if-match ETAG"]:::step
        s18["aws cloudfront create-invalidation --paths /*"]:::step
        s1 --> s2 --> s3 --> s4 --> s5 --> s6 --> s7 --> s8 --> s9 --> s10 --> s11 --> s12 --> s13 --> s14 --> s15 --> s16 --> s17 --> s18
    end
```

The deploy-docs job also re-evaluates `if: github.event_name == 'workflow_dispatch' || github.event_name == 'release'` as belt-and-suspenders.

[Back to top](#navigate)

---

## 4. Step-by-step lifecycle

One end-to-end run, from event to invalidation.

```mermaid
sequenceDiagram
    autonumber
    participant E as Event
    participant GH as GitHub Actions
    participant R as Runner
    participant FS as Workspace FS
    participant STS as AWS STS
    participant S3 as AWS S3
    participant CF as AWS CloudFront

    E->>GH: workflow_dispatch or release.published
    GH->>R: schedule check-deploy-branch
    R->>R: branch guard (target_commitish or GITHUB_REF)
    R-->>GH: exit 0
    GH->>R: schedule deploy-docs
    R->>FS: checkout@v4 (GITHUB_TOKEN)
    R->>R: setup-node (24.x) + cache
    R->>R: npm install
    R->>FS: read package.json version
    R->>R: PACKAGE_ID = version + unix timestamp
    R->>FS: write docs/.env (VITE_PACKAGE_ID)
    R->>R: npm run docs:update-providers
    R->>R: npm run docs:build (VitePress)
    R->>GH: upload-artifact docs (30 days)
    R->>STS: AssumeRoleWithWebIdentity (OIDC JWT)
    STS-->>R: temporary AWS credentials
    R->>STS: sts:GetCallerIdentity (sanity check)
    R->>FS: mkdir dist, copy build + package.json
    R->>S3: PUT objects under docs/(PACKAGE_ID)/
    R->>CF: GetDistributionConfig
    CF-->>R: DistributionConfig + ETag
    R->>FS: jq mutate OriginPath to /docs/(PACKAGE_ID)
    R->>CF: UpdateDistribution (--if-match ETag)
    R->>CF: CreateInvalidation paths /*
    CF-->>R: invalidation queued
```

Source: [.github/workflows/deploy-docs.yml](../workflows/deploy-docs.yml) lines 36-141.

[Back to top](#navigate)

---

## 5. The PACKAGE_ID convention

`PACKAGE_ID` is the keystone. Same string lands in three places: the build env, the S3 prefix, and the CloudFront origin path.

```mermaid
flowchart LR
    classDef src fill:#0e7490,color:#fff,stroke:#000
    classDef mix fill:#7c2d12,color:#fff,stroke:#000
    classDef sink fill:#581c87,color:#fff,stroke:#000

    A["jq -r .version package.json\nexample 2.3.6"]:::src
    B["date +%s\nexample 1736380800"]:::src
    A --> M["PACKAGE_ID = (version)-(timestamp)\nexample 2.3.6-1736380800"]:::mix
    B --> M

    M --> U1["docs/.env\nVITE_PACKAGE_ID=(PACKAGE_ID)\nbaked into Vite build via import.meta.env"]:::sink
    M --> U2["S3 prefix\ns3://(BUCKET)/docs/(PACKAGE_ID)/"]:::sink
    M --> U3["CloudFront OriginPath\n/docs/(PACKAGE_ID)"]:::sink

    U1 --> R[("rendered HTML/JS bundle\nknows its own version")]
    U2 --> R2[("immutable build artifacts in S3")]
    U3 --> R3[("live distribution points at this prefix")]
```

The timestamp suffix means two deploys of the same `package.json` version still get distinct prefixes. Old prefixes stay in S3 as a rollback inventory.

[Back to top](#navigate)

---

## 6. The OIDC federation handshake

No long-lived AWS keys live in GitHub. The job mints a short-lived JWT, STS verifies it against the configured trust policy, and returns temporary credentials.

```mermaid
sequenceDiagram
    autonumber
    participant J as deploy-docs job
    participant TKN as GitHub OIDC issuer\n(token.actions.githubusercontent.com)
    participant ACT as configure-aws-credentials@v4
    participant IAM as AWS IAM trust policy
    participant STS as AWS STS

    Note over J: permissions.id-token: write enables OIDC
    J->>TKN: request OIDC JWT for this run
    TKN-->>J: signed JWT (sub, aud, repo, ref claims)
    J->>ACT: pass role-to-assume, role-session-name, aws-region
    ACT->>STS: AssumeRoleWithWebIdentity(JWT, RoleArn)
    STS->>IAM: validate JWT signature and trust conditions
    IAM-->>STS: claims match (repo, branch, environment)
    STS-->>ACT: AccessKeyId + SecretAccessKey + SessionToken
    ACT-->>J: env vars AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
    J->>STS: sts:GetCallerIdentity (sanity check, prints ARN)
    STS-->>J: assumed-role ARN with session-name GitHub_to_AWS_via_FederatedOIDC
```

If the trust policy on `vars.AWS_ROLE_DEPLOY_ARN` does not match the repo, branch, or session-name claims, `AssumeRoleWithWebIdentity` fails and every subsequent AWS call returns `AccessDenied`.

[Back to top](#navigate)

---

## 7. The CloudFront origin-rotation pattern

The live URL never changes. What changes is which S3 prefix CloudFront treats as origin root. The mutation goes through read-modify-write with an ETag guard.

```mermaid
flowchart TB
    classDef io fill:#0e7490,color:#fff,stroke:#000
    classDef act fill:#1e3a8a,color:#fff,stroke:#000
    classDef warn fill:#7c2d12,color:#fff,stroke:#000
    classDef ok fill:#064e3b,color:#fff,stroke:#000

    A["aws cloudfront get-distribution-config\n--id (DIST_ID)\nwrite to dist-config.json"]:::act
    A --> B["jq -r .ETag dist-config.json\nexport as ETAG"]:::io
    A --> C["jq .DistributionConfig dist-config.json\nwrite to distribution-config.json"]:::io
    B --> D["jq .Origins.Items[0].OriginPath = /docs/(PACKAGE_ID)\nwrite to new-distribution-config.json"]:::act
    C --> D
    D --> E["aws cloudfront update-distribution\n--id (DIST_ID)\n--distribution-config file://new-distribution-config.json\n--if-match (ETAG)"]:::act
    E -->|ETag matches| F["distribution config updated\nnew ETag returned"]:::ok
    E -->|ETag stale| G["PreconditionFailed\nstep fails, no half-update"]:::warn
    F --> H["aws cloudfront create-invalidation\n--paths /*"]:::act
    H --> I["edge caches drop old origin objects\nnext request fetches from new /docs/(PACKAGE_ID)/"]:::ok
```

The `--if-match` ETag is the optimistic-lock. If anything else mutated the distribution between `get` and `update`, the workflow fails loudly rather than clobbering.

[Back to top](#navigate)

---

## 8. External calls

Who is contacted, with what credential, why.

```mermaid
flowchart LR
    classDef pre fill:#155e75,color:#fff,stroke:#000
    classDef build fill:#1e3a8a,color:#fff,stroke:#000
    classDef aws fill:#064e3b,color:#fff,stroke:#000
    classDef art fill:#581c87,color:#fff,stroke:#000

    subgraph Pre["Before AWS"]
        c1["actions/checkout@v4\nauth: default GITHUB_TOKEN\nwhy: clone repo at the dispatched ref"]:::pre
        c2["./.github/actions/setup-node\nauth: none\nwhy: install Node 24.x + npm registry"]:::pre
        c3["./.github/actions/cache\nauth: none\nwhy: warm node_modules"]:::pre
        c4["npm registry\nauth: anonymous\nwhy: npm install"]:::build
    end

    subgraph Build["Build"]
        b1["npm run docs:update-providers\nupdates provider metadata in docs"]:::build
        b2["npm run docs:build\nVitePress build to docs/.vitepress/dist"]:::build
        b3["actions/upload-artifact@v4\nname: docs, 30-day retention"]:::art
    end

    subgraph AWS["AWS plane"]
        a1["AWS STS\nauth: OIDC JWT\nwhy: AssumeRoleWithWebIdentity"]:::aws
        a2["AWS IAM (trust policy)\nauth: none (read by STS)\nwhy: validate repo/branch claims"]:::aws
        a3["AWS S3\nauth: temporary creds\nwhy: PUT docs/(PACKAGE_ID)/*"]:::aws
        a4["AWS CloudFront\nauth: temporary creds\nwhy: GET/UPDATE config, create invalidation"]:::aws
    end

    c1 --> c2 --> c3 --> c4 --> b1 --> b2 --> b3
    b3 --> a1
    a1 --> a2 --> a3
    a2 --> a4
```

Variables and secrets used:

| Reference | Type | Used by |
|-----------|------|---------|
| `vars.AWS_ROLE_DEPLOY_ARN` | repo/org variable | configure-aws-credentials role-to-assume |
| `vars.AWS_REGION` | repo/org variable | configure-aws-credentials aws-region |
| `vars.AWS_S3_BUCKET` | repo/org variable | S3 cp destination |
| `vars.AWS_CLOUDFRONT_DISTRIBUTION_ID` | repo/org variable | cloudfront get/update/invalidate |
| `GITHUB_TOKEN` (default) | per-job token | checkout |
| OIDC JWT | per-job token | STS AssumeRoleWithWebIdentity |

No long-lived AWS access key is configured. Rotation is implicit: every job mints fresh creds.

[Back to top](#navigate)

---

## 9. Why versioned S3 folders + origin rotation

Two design choices that look like complexity but bought specific properties.

```mermaid
flowchart TB
    classDef prop fill:#0e7490,color:#fff,stroke:#000
    classDef alt fill:#7c2d12,color:#fff,stroke:#000
    classDef win fill:#064e3b,color:#fff,stroke:#000

    subgraph Choices["Design choices"]
        C1["Every deploy writes to a fresh\ndocs/(version)-(timestamp)/ prefix"]:::prop
        C2["CloudFront OriginPath is rotated\nto point at the new prefix"]:::prop
        C3["Old prefixes are NOT deleted"]:::prop
    end

    subgraph Wins["What you get"]
        W1["Atomic publish\nno partial-write window:\nuploads finish, then origin flips"]:::win
        W2["Instant rollback\nrotate OriginPath back to any\nprior prefix, invalidate, done"]:::win
        W3["Stable URL\nllm-exe.com/... never changes\nclients see a flip, not a redirect"]:::win
        W4["Cache safety\nold bundles still resolvable\nif stragglers hit the edge"]:::win
        W5["Audit trail\nevery historical build is still\nbrowsable by prefix in S3"]:::win
    end

    subgraph Alts["What the alternative would cost"]
        A1["Overwrite a single prefix\n= broken site during upload\n+ cache-busting pain"]:::alt
        A2["Blue/green domains\n= different URLs per deploy\n+ DNS or alias gymnastics"]:::alt
        A3["No invalidation\n= stale assets for users\nfor hours"]:::alt
    end

    C1 --> W1
    C1 --> W4
    C1 --> W5
    C2 --> W2
    C2 --> W3
    C3 --> W2
    A1 -.avoided.-> W1
    A2 -.avoided.-> W3
    A3 -.avoided.-> W4
```

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

    DD["deploy-docs.yml\nrun completes"]:::src

    DD --> A1["GitHub Actions artifact\nname: docs (30-day retention)"]:::out
    DD --> A2["S3 objects under\ndocs/(PACKAGE_ID)/"]:::out
    DD --> A3["Updated CloudFront distribution\nOriginPath = /docs/(PACKAGE_ID)"]:::out
    DD --> A4["CloudFront invalidation\npaths /*"]:::out

    A1 --> C1["maintainer download for inspection\nor diff against prior build"]:::human
    A2 --> C2["CloudFront origin lookup\non cache miss"]:::cons
    A3 --> C2
    A4 --> C3["edge cache nodes\nflush old objects"]:::cons
    C3 --> C4["next end-user request\nfetches from new prefix"]:::cons
    C4 --> END["live docs site\nshows new version"]:::cons
    A2 --> RB["rollback option\nrotate OriginPath to prior prefix"]:::human
```

The artifact upload is a safety net. The real publish is the S3 PUT plus the CloudFront flip.

[Back to top](#navigate)

---

## 11. The state machine

A single deploy as a finite state machine.

```mermaid
stateDiagram-v2
    [*] --> Queued: event arrives
    Queued --> Guarding: check-deploy-branch starts
    Guarding --> Rejected: wrong branch
    Guarding --> Authorized: branch ok
    Authorized --> Booting: deploy-docs starts
    Booting --> Installed: checkout + node + cache + npm install
    Installed --> Built: docs:update-providers + docs:build
    Built --> Uploaded: upload-artifact succeeded
    Uploaded --> AwsAuthed: configure-aws-credentials returned creds
    AwsAuthed --> S3Deployed: aws s3 cp completed
    S3Deployed --> CfConfigRead: get-distribution-config returned ETag + config
    CfConfigRead --> CfRotated: update-distribution --if-match succeeded
    CfRotated --> Invalidating: create-invalidation queued
    Invalidating --> Live: edges flush, end users see new version
    Built --> BuildFailed: VitePress error
    AwsAuthed --> AwsDenied: STS or IAM rejection
    S3Deployed --> S3Failed: PUT error
    CfConfigRead --> StaleEtag: PreconditionFailed
    BuildFailed --> [*]
    AwsDenied --> [*]
    S3Failed --> [*]
    StaleEtag --> [*]
    Rejected --> [*]
    Live --> [*]
```

The S3 PUT is the point of no easy return: once new objects exist under the new prefix, the only forward path is to either flip CloudFront or leave the new prefix as cold inventory.

[Back to top](#navigate)

---

## 12. Failure modes

Where things break, what happens, what to do.

```mermaid
flowchart TB
    classDef fail fill:#7c2d12,color:#fff,stroke:#000
    classDef effect fill:#374151,color:#fff,stroke:#000
    classDef fix fill:#064e3b,color:#fff,stroke:#000

    F1["Wrong branch\n(release not from main, or dispatch\nfrom branch other than dev/main)"]:::fail
    F1 --> F1E["check-deploy-branch exits 1\ndeploy-docs never runs"]:::effect
    F1F["create release from main\nor dispatch from development/main"]:::fix
    F1E --> F1F

    F2["OIDC denied\ntrust policy claim mismatch"]:::fail
    F2 --> F2E["AssumeRoleWithWebIdentity fails\nall AWS steps return AccessDenied"]:::effect
    F2F["check role trust policy:\nrepo, branch, session-name claims"]:::fix
    F2E --> F2F

    F3["S3 write fails\n(missing s3:PutObject or bucket policy)"]:::fail
    F3 --> F3E["aws s3 cp returns non-zero\nstep fails before CloudFront touched"]:::effect
    F3F["grant role s3:PutObject on\narn:aws:s3:::(BUCKET)/docs/*"]:::fix
    F3E --> F3F

    F4["VitePress build fails\n(broken docs/, missing partial)"]:::fail
    F4 --> F4E["npm run docs:build exits non-zero\nno artifact uploaded, no S3 PUT"]:::effect
    F4F["fix docs source, rerun"]:::fix
    F4E --> F4F

    F5["CloudFront update fails\nstale ETag (PreconditionFailed)"]:::fail
    F5 --> F5E["update-distribution rejected\nS3 has new prefix but live origin still old\nno invalidation issued"]:::effect
    F5F["re-run the workflow\nget-config returns fresh ETag"]:::fix
    F5E --> F5F

    F6["Missing CloudFront permission"]:::fail
    F6 --> F6E["get-distribution-config or update returns AccessDenied"]:::effect
    F6F["grant role cloudfront:GetDistributionConfig,\ncloudfront:UpdateDistribution,\ncloudfront:CreateInvalidation"]:::fix
    F6E --> F6F

    F7["docs/.env not written\n(VITE_PACKAGE_ID missing)"]:::fail
    F7 --> F7E["build runs but bundle has no PACKAGE_ID\nclient-side version display blank"]:::effect
    F7F["check docs/.env step\nand env: PACKAGE_ID forwarding"]:::fix
    F7E --> F7F

    F8["Invalidation queued but slow"]:::fail
    F8 --> F8E["users may see prior version\nfor a few minutes at edge"]:::effect
    F8F["expected, not a failure\ntypical propagation under 5 minutes"]:::fix
    F8E --> F8F
```

The dangerous failure is F5: S3 has the new build but CloudFront still points at the old origin. The fix is idempotent (rerun gets a fresh ETag and rotates), but the deploy is in a half-state until then.

[Back to top](#navigate)

---

## 13. Quick reference card

```mermaid
flowchart LR
    classDef k fill:#1e3a8a,color:#fff,stroke:#000
    classDef v fill:#374151,color:#fff,stroke:#000

    K1["File"]:::k --- V1[".github/workflows/deploy-docs.yml"]:::v
    K2["Triggers"]:::k --- V2["workflow_dispatch + release.published"]:::v
    K3["Permissions"]:::k --- V3["id-token: write, contents: read"]:::v
    K4["Branch guard (release)"]:::k --- V4["target_commitish == main"]:::v
    K5["Branch guard (dispatch)"]:::k --- V5["GITHUB_REF in development|main"]:::v
    K6["Jobs"]:::k --- V6["check-deploy-branch, deploy-docs (needs guard)"]:::v
    K7["Node version"]:::k --- V7["24.x (./.github/actions/setup-node)"]:::v
    K8["Cache"]:::k --- V8["node_modules (./.github/actions/cache); ~/.npm via setup-node@v6 cache: npm"]:::v
    K9["Build commands"]:::k --- V9["npm run docs:update-providers + docs:build"]:::v
    K10["Build output"]:::k --- V10["docs/.vitepress/dist/"]:::v
    K11["PACKAGE_ID"]:::k --- V11["(package.json version)-(unix timestamp)"]:::v
    K12["Build env injection"]:::k --- V12["docs/.env VITE_PACKAGE_ID + step env"]:::v
    K13["Artifact"]:::k --- V13["name: docs, retention: 30 days"]:::v
    K14["AWS auth"]:::k --- V14["OIDC AssumeRoleWithWebIdentity\nsession: GitHub_to_AWS_via_FederatedOIDC"]:::v
    K15["AWS vars"]:::k --- V15["AWS_ROLE_DEPLOY_ARN, AWS_REGION, AWS_S3_BUCKET, AWS_CLOUDFRONT_DISTRIBUTION_ID"]:::v
    K16["S3 destination"]:::k --- V16["s3://(BUCKET)/docs/(PACKAGE_ID)/"]:::v
    K17["CloudFront mutation"]:::k --- V17["Origins.Items[0].OriginPath = /docs/(PACKAGE_ID)"]:::v
    K18["Concurrency"]:::k --- V18["lock guarded by ETag --if-match"]:::v
    K19["Invalidation"]:::k --- V19["paths /*"]:::v
    K20["Rollback"]:::k --- V20["re-run with prior PACKAGE_ID or rotate OriginPath manually"]:::v
```

Direct links:

- Workflow file: [.github/workflows/deploy-docs.yml](../workflows/deploy-docs.yml)
- Composite actions: [setup-node](../actions/setup-node/action.yml), [cache](../actions/cache/action.yml)
- Build scripts: `docs:update-providers`, `docs:build`, `predocs:build` in [package.json](../../package.json)
- VitePress source: [docs/](../../docs/)

[Back to top](#navigate)
