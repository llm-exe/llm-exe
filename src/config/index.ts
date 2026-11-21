// BROWSER-SAFE barrel — re-exported from the package root (src/index.ts).
// MUST NOT import fromFile.ts or node.ts (they touch node:fs). The CI Node-free
// root-graph gate enforces this.
export { loadExecutorConfig, executorFromConfig, runConfig } from "./assemble";
export { parseExecutorConfig, formatFromExtension } from "./parse";
export { loadConfigFromUrl } from "./fromUrl";
export type {
  ExecutorConfig,
  ExecutorConfigPatch,
  Format,
  ProviderKey,
  ExecutorCreateOptions,
  RunOverrides,
} from "./types";
