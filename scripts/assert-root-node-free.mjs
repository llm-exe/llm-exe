// Regression guard for the config layer's finding #1: the browser-safe root
// barrel (src/index.ts) must never transitively reach a Node-only module.
//
// We build the LOCAL module graph of src/index.ts (node_modules + node:
// builtins externalized via packages:"external", tsconfig paths resolved) and
// assert that no Node-only config source file is among the inputs. This is a
// precise structural check — it does not false-fail on the AWS SDK's own
// node-builtin usage the way a full browser-bundle assertion would.
import { build } from "esbuild";

const NODE_ONLY = [/src\/config\/fromFile\.ts$/, /src\/config\/node\.ts$/];
const FORBIDDEN_IMPORT = /(?:^|[^.\w])(?:node:)?fs(?:\/promises)?$/;

const result = await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  write: false,
  metafile: true,
  platform: "neutral",
  format: "esm",
  packages: "external",
  tsconfig: "tsconfig.json",
  logLevel: "silent",
});

const inputs = Object.keys(result.metafile.inputs);

const leakedModules = inputs.filter((file) =>
  NODE_ONLY.some((re) => re.test(file))
);

const fsImporters = [];
for (const [file, meta] of Object.entries(result.metafile.inputs)) {
  for (const imp of meta.imports ?? []) {
    if (FORBIDDEN_IMPORT.test(imp.path)) {
      fsImporters.push(`${file} -> ${imp.path}`);
    }
  }
}

if (leakedModules.length || fsImporters.length) {
  console.error("✗ Root graph is NOT Node-free.");
  if (leakedModules.length) {
    console.error("  Node-only modules reachable from src/index.ts:");
    leakedModules.forEach((f) => console.error(`    - ${f}`));
  }
  if (fsImporters.length) {
    console.error("  fs imports reachable from src/index.ts:");
    fsImporters.forEach((f) => console.error(`    - ${f}`));
  }
  console.error(
    "\n  File loading must stay behind the `llm-exe/node` subpath (src/config/node.ts)."
  );
  process.exit(1);
}

console.log(
  `✓ Root graph is Node-free (${inputs.length} local modules, no fs / node-only config reachable).`
);
