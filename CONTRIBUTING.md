# Contributing to llm-exe

Thanks for considering a contribution. This document covers the practical mechanics: how to set up, what the project values, and what we expect on a pull request.

If you are reporting a security issue, see [SECURITY.md](./SECURITY.md). If you are reporting an accessibility issue, see [ACCESSIBILITY.md](./ACCESSIBILITY.md). For everything else, an issue is the right starting point before a PR.

## Project values

The principles in [CLAUDE.md](./CLAUDE.md) are not just for tooling; they describe the bar for human contributions too. The short version:

- **Lightweight.** Thin abstraction layer. No heavy dependencies.
- **Provider-agnostic.** One interface, any LLM.
- **TypeScript-first.** Full inference from prompt input through parser output. No `any`, no broken inference, no manual casting.
- **Modular.** Four pillars: Prompt, LLM, Parser, Executor. Respect the boundaries.
- **Text-only scope.** Tool calls are in. Image, audio, and video are not.

Read the [Feature Evaluation](./CLAUDE.md#feature-evaluation--read-this-before-adding-features) section before proposing a new feature. We do not race to support every new LLM capability.

## Getting set up

```bash
git clone https://github.com/llm-exe/llm-exe.git
cd llm-exe
npm install
```

Common commands:

```bash
npm test                # Jest test suite
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run build:ci        # tsup (CJS / ESM / DTS)
```

For docs site work:

```bash
npm run docs:dev        # local dev server
npm run docs:build      # static build into docs/.vitepress/dist
```

## Branching and pull requests

- Branch from `development`. PRs target `development`.
- Keep PRs focused. One concern per PR.
- Include tests for new code. Tests live next to the file they cover: `foo.ts` and `foo.test.ts` in the same directory.
- Use `openai.chat-mock.v1` and the `mockOutputResultObject` helper from `utils/mock.helpers.ts` instead of hitting real provider APIs.

Before opening a PR:

1. Run `npm test`. Everything passes.
2. Run `npm run typecheck`. No errors.
3. Run `npm run lint`. No new warnings.
4. If your change affects response types, executor generics, or parser output, confirm a downstream consumer still infers the result type without casting.
5. Walk through the accessibility checklist in the PR template.

## Versioning

We follow [semver](https://semver.org/):

- **patch** (`2.3.x`): bug fixes, no API changes.
- **minor** (`2.x.0`): backwards-compatible features. New parsers, providers, options.
- **major** (`x.0.0`): breaking changes. Rare.

If the change requires existing user code to be modified to keep working, it is breaking. Label the issue `breaking` and target the next major milestone (create one if it does not exist, e.g. `v3.0.0`). When in doubt, it is probably not breaking.

The maintainer cuts releases. Contributors organize; the maintainer ships.

## Commit messages

Use conventional, imperative-mood subjects:

- `fix: handle empty content array in OutputResult`
- `feat: add deepseek shorthand for deepseek-reasoner`
- `docs: clarify executor generic inference`
- `test: cover parser stringExtract empty enum`

Reference issues with `Refs #123` or `Closes #123` in the body.

## Code review

Expect direct review comments. We point at the specific line and the specific reason. If you disagree with a review note, push back with technical evidence (a failing test, a benchmark, a counter-example). "I prefer it this way" is not a sufficient argument in either direction.

## Reporting bugs and requesting features

- [Bug report](./.github/ISSUE_TEMPLATE/bug_report.yml)
- [Feature request](./.github/ISSUE_TEMPLATE/feature_request.yml)
- [Accessibility issue](./.github/ISSUE_TEMPLATE/accessibility.yml)

For questions and discussion that do not fit an issue template, open a [Discussion](https://github.com/llm-exe/llm-exe/discussions) if Discussions are enabled, or a low-severity issue otherwise.

## Code of conduct

Participation in this project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).
