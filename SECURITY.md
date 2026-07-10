# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Use either of the following private channels:

1. **GitHub private vulnerability reporting.** Go to the repository's [Security tab](https://github.com/llm-exe/llm-exe/security) and choose **Report a vulnerability**. This routes directly to the maintainers.
2. **Email.** Send a report to **help@llm-exe.com** with `[security]` in the subject line.

Include in your report:

- A description of the issue and the impact you believe it has.
- The version of llm-exe affected, plus Node.js version and provider involved if relevant.
- A minimal reproduction. Strip API keys and other secrets before sharing.
- Any logs, stack traces, or proof of concept output. Redact secrets.

## What to expect

- We will acknowledge receipt within seven days.
- We will keep you updated as we triage and work on a fix.
- We will coordinate disclosure with you. We do not publish details before users have a reasonable window to update.
- We will credit you in the release notes for the fix unless you ask us not to.

## Supported versions

We provide security fixes for the current minor version on the `main` branch. Older minor versions may receive backported fixes at the maintainer's discretion if the upgrade path is non-trivial.

| Version | Status |
| --- | --- |
| Latest minor on `main` | Supported |
| Previous minor | Best-effort backport for high-severity issues |
| Older | Not supported |

## Scope

The following are in scope for security reports:

- The published `llm-exe` npm package source.
- The documentation site at [llm-exe.com](https://llm-exe.com).
- GitHub Actions workflows in this repository.

The following are out of scope:

- Vulnerabilities in upstream LLM providers. Report those to the provider directly.
- Issues that require an attacker to already control the host running the library (e.g. arbitrary file write when the attacker can already execute code).
- Denial of service caused by sending the library extremely large inputs in a context the application chose not to limit. Application-level input limits are the responsibility of the consuming application.

## Known classes of issue we already track

- **Secrets in error messages.** API keys and other provider credentials must not appear in error messages, log output, or thrown exceptions. We treat any leak as a high-severity bug. If you find one, file it under this policy.
