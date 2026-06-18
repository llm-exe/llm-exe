// NODE-ONLY barrel — built into the `llm-exe/node` subpath export.
// NOT imported by config/index.ts or src/index.ts (it touches node:fs).
export { loadConfigFromFile, executorFromFile, runFile } from "./fromFile";
