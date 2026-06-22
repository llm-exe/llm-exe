# Accessibility

llm-exe is a TypeScript library for building LLM-powered applications. The library itself has no UI, but the project ships two user-facing surfaces that we hold to accessibility standards:

1. The documentation site at [llm-exe.com](https://llm-exe.com) (VitePress + Vue).
2. The project README and markdown docs as rendered by GitHub and npm.

This document states our goals, the standards we hold ourselves to, and how to report issues. It is a living document. If you find a gap between what we say here and what we ship, that is a bug worth filing.

## Goals

- The documentation site targets [WCAG 2.1 Level AA](https://www.w3.org/TR/WCAG21/) where feasible.
- All markdown content (README, guides, references) follows the structural rules below regardless of where it is rendered.
- Error messages and logs produced by the library follow the CLI/log accessibility guidance from [opensource.guide](https://opensource.guide/accessibility-best-practices-for-your-project/): plain language, no meaning conveyed by color alone, machine-readable shapes where it helps tooling.

## Standards we hold ourselves to

### Documentation site

- Every image has descriptive alt text, or is explicitly marked decorative with `alt=""`.
- Interactive elements use native HTML (`<button>`, `<a>`, `<input>`, `<select>`). Clickable `<div>` or `<span>` is treated as a bug.
- All form controls have a programmatically associated label, either via `<label for="...">`, wrapped `<label>`, or `aria-label` when no visible label exists.
- State changes (selected, pressed, current, expanded) are conveyed through ARIA state attributes, not color alone.
- Heading hierarchy does not skip levels.
- Animations and transitions honor `prefers-reduced-motion: reduce`.
- The site declares `lang="en-US"`.
- `list-style: none` lists carry `role="list"` to defend against the WebKit + VoiceOver bug that strips list semantics when default markers are removed.

### Library output

- Errors thrown by the library state what happened and, where possible, how to fix it.
- API keys, bearer tokens, and other secrets must not appear in error messages, log lines, or any other output the library produces. Tracked in [llm-exe-error-key-leak](https://github.com/llm-exe/llm-exe/issues?q=is%3Aissue+label%3Asecurity).
- Severity, status, and identity information is communicated by text, not by ANSI color alone. Consumers running in pipes, CI, or screen readers see the same information.

## Known limitations

- Code blocks in the docs site rely on syntax-highlighting colors. Each example also includes a textual explanation so the meaning does not depend on the colors. If you find an example that does not, it is a bug.
- The library is text-in / text-out. We do not ship image, audio, or video features, so the relevant subset of WCAG (alt text, captions, audio descriptions) only applies to docs media, not to the library surface.

## Supported environments

- The docs site is tested in current Chrome, Firefox, and Safari.
- The library itself runs in Node.js 18+ and modern browsers via ESM.
- We do not currently run automated screen reader testing in CI. Manual testing is performed with VoiceOver (macOS Safari) and NVDA (Windows Firefox) before significant docs site changes.

## Reporting an accessibility issue

Use the [Accessibility issue template](https://github.com/llm-exe/llm-exe/issues/new?template=accessibility.yml). Include:

- Where you encountered the issue (URL or file path).
- What you expected to happen.
- What actually happened.
- Your operating system, browser, and assistive technology versions if applicable.
- A severity estimate using the taxonomy below.

### Severity taxonomy

- **Critical**: A user with a disability cannot complete a core task. Example: cannot reach a primary navigation control by keyboard.
- **High**: Significant difficulty completing a core task, with a workaround that takes substantial extra effort.
- **Medium**: Inconsistency, annoyance, or partial barrier with an obvious workaround.
- **Low**: Cosmetic or minor friction.

We will acknowledge new accessibility reports within seven days. Criticals are prioritized above non-security bugs. We will follow up with you to confirm fixes before closing.

## Contributor expectations

If you open a pull request, the PR template includes an accessibility checklist. Walk through it. Items that do not apply should be marked `n/a` rather than left blank, so reviewers know you considered them.

For docs site PRs specifically, before requesting review:

1. Tab through any new interactive element from the keyboard. Confirm it is reachable, the focus indicator is visible, and Enter / Space activates it.
2. Open the page in a forced-colors / high-contrast mode and confirm state and meaning are still visible.
3. Verify any new image has alt text that conveys the same information a sighted user gets from the image.

We do not require contributors to own a screen reader, but if you have one available, a five-minute pass over your change catches a lot.

## What is not in scope

- Touch target sizing, drag-and-drop alternatives, device-motion alternatives, and similar guidance from the opensource.guide page apply to apps with a UI surface. llm-exe is a library; those items only become relevant inside the docs site.
- We follow WCAG 2.1 AA, not AAA. We are open to AAA improvements but do not block on them.
