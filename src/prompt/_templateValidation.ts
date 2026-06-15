import { hbs } from "@/utils/modules/handlebars";

export interface TemplateInputReference {
  path: string;
  source: "mustache" | "block-param" | "helper-param" | "hash";
  location?: string;
}

export interface TemplateInputValidationResult {
  references: TemplateInputReference[];
  missingVariables: TemplateInputReference[];
  missingHelpers: string[];
}

interface CollectOptions {
  helpers?: Record<string, unknown>;
  location?: string;
}

const BUILT_IN_HELPERS = new Set([
  "if",
  "unless",
  "each",
  "with",
  "lookup",
  "log",
  "blockHelperMissing",
  "helperMissing",
]);

interface PathNode {
  type: "PathExpression";
  original: string;
  parts: string[];
  depth: number;
  data: boolean;
}

interface HashPair {
  key: string;
  value: ExpressionNode;
}

interface HashNode {
  pairs: HashPair[];
}

interface SubExpressionNode {
  type: "SubExpression";
  path: PathNode;
  params: ExpressionNode[];
  hash?: HashNode;
}

interface LiteralNode {
  type:
    | "StringLiteral"
    | "NumberLiteral"
    | "BooleanLiteral"
    | "NullLiteral"
    | "UndefinedLiteral";
}

type ExpressionNode = PathNode | SubExpressionNode | LiteralNode;

interface ProgramNode {
  type: "Program";
  body: StatementNode[];
  blockParams?: string[];
}

interface MustacheStatementNode {
  type: "MustacheStatement";
  path: PathNode | SubExpressionNode | LiteralNode;
  params: ExpressionNode[];
  hash?: HashNode;
}

interface BlockStatementNode {
  type: "BlockStatement";
  path: PathNode;
  params: ExpressionNode[];
  hash?: HashNode;
  program?: ProgramNode;
  inverse?: ProgramNode;
}

interface PartialStatementNode {
  type: "PartialStatement";
  name: PathNode | LiteralNode;
  params: ExpressionNode[];
  hash?: HashNode;
}

type StatementNode =
  | MustacheStatementNode
  | BlockStatementNode
  | PartialStatementNode
  | { type: string };

function isKnownHelper(
  name: string,
  customHelpers?: Record<string, unknown>
): boolean {
  if (BUILT_IN_HELPERS.has(name)) return true;
  if (customHelpers && Object.prototype.hasOwnProperty.call(customHelpers, name)) {
    return true;
  }
  return false;
}

function pathRootSegment(path: PathNode): string | null {
  if (path.depth > 0) return null;
  if (path.data) return null;
  if (path.parts.length === 0) return null;
  return path.parts[0];
}

function pathToCollectedString(path: PathNode): string {
  const parts = path.parts.slice();
  return parts.join(".");
}

function collectFromPath(
  path: PathNode,
  source: TemplateInputReference["source"],
  locals: Set<string>,
  options: CollectOptions,
  references: TemplateInputReference[],
  seen: Set<string>
): void {
  const root = pathRootSegment(path);
  if (!root) return;
  if (locals.has(root)) return;
  const collected = pathToCollectedString(path);
  const dedupKey = `${source}::${collected}`;
  if (seen.has(dedupKey)) return;
  seen.add(dedupKey);
  references.push({
    path: collected,
    source,
    location: options.location,
  });
}

function collectFromExpression(
  expr: ExpressionNode,
  source: TemplateInputReference["source"],
  locals: Set<string>,
  options: CollectOptions,
  references: TemplateInputReference[],
  missingHelpers: Set<string>,
  seen: Set<string>
): void {
  if (expr.type === "PathExpression") {
    collectFromPath(expr, source, locals, options, references, seen);
    return;
  }
  if (expr.type === "SubExpression") {
    walkCall(
      expr.path,
      expr.params,
      expr.hash,
      locals,
      options,
      references,
      missingHelpers,
      seen
    );
    return;
  }
  // literals — nothing to collect
}

function walkHash(
  hash: HashNode | undefined,
  locals: Set<string>,
  options: CollectOptions,
  references: TemplateInputReference[],
  missingHelpers: Set<string>,
  seen: Set<string>
): void {
  if (!hash || !hash.pairs) return;
  for (const pair of hash.pairs) {
    collectFromExpression(
      pair.value,
      "hash",
      locals,
      options,
      references,
      missingHelpers,
      seen
    );
  }
}

function walkCall(
  path: PathNode,
  params: ExpressionNode[],
  hash: HashNode | undefined,
  locals: Set<string>,
  options: CollectOptions,
  references: TemplateInputReference[],
  missingHelpers: Set<string>,
  seen: Set<string>
): void {
  const root = pathRootSegment(path);
  const hasArgs =
    params.length > 0 || (hash !== undefined && hash.pairs.length > 0);

  if (hasArgs) {
    if (root) {
      // helper-style call; treat path.original as a helper name
      if (!isKnownHelper(path.original, options.helpers) && !locals.has(root)) {
        missingHelpers.add(path.original);
      }
    }
    for (const param of params) {
      collectFromExpression(
        param,
        "helper-param",
        locals,
        options,
        references,
        missingHelpers,
        seen
      );
    }
    walkHash(hash, locals, options, references, missingHelpers, seen);
    return;
  }

  // bare reference, no arguments — treat as data unless it's a known helper
  if (root && isKnownHelper(path.original, options.helpers)) {
    // bare helper invocation (e.g. {{log}}) — nothing to collect
    return;
  }
  collectFromPath(path, "mustache", locals, options, references, seen);
}

function walkProgram(
  program: ProgramNode | undefined,
  parentLocals: Set<string>,
  options: CollectOptions,
  references: TemplateInputReference[],
  missingHelpers: Set<string>,
  seen: Set<string>
): void {
  if (!program) return;
  const locals = new Set(parentLocals);
  if (program.blockParams) {
    for (const bp of program.blockParams) {
      locals.add(bp);
    }
  }
  for (const node of program.body) {
    walkStatement(node, locals, options, references, missingHelpers, seen);
  }
}

function walkStatement(
  node: StatementNode,
  locals: Set<string>,
  options: CollectOptions,
  references: TemplateInputReference[],
  missingHelpers: Set<string>,
  seen: Set<string>
): void {
  switch (node.type) {
    case "MustacheStatement": {
      const m = node as MustacheStatementNode;
      if (m.path.type === "PathExpression") {
        walkCall(
          m.path as PathNode,
          m.params,
          m.hash,
          locals,
          options,
          references,
          missingHelpers,
          seen
        );
      }
      return;
    }
    case "BlockStatement": {
      const b = node as BlockStatementNode;
      const root = pathRootSegment(b.path);
      if (root && !isKnownHelper(b.path.original, options.helpers) && !locals.has(root)) {
        missingHelpers.add(b.path.original);
      }
      for (const param of b.params) {
        collectFromExpression(
          param,
          "block-param",
          locals,
          options,
          references,
          missingHelpers,
          seen
        );
      }
      walkHash(b.hash, locals, options, references, missingHelpers, seen);

      // Special handling for `#each` without explicit block params:
      // bare paths inside refer to current item, not root input.
      const isEach = b.path.original === "each";
      const hasBlockParams =
        (b.program?.blockParams && b.program.blockParams.length > 0) ||
        (b.inverse?.blockParams && b.inverse.blockParams.length > 0);

      if (isEach && !hasBlockParams) {
        // Walk children with a "swallow bare paths" mode: any single-segment
        // root path that has no dot is treated as a local item reference and
        // not collected. We approximate this by injecting a sentinel local
        // for any root-level path encountered; simpler: skip walking program
        // body for collection entirely except block-level params/hash.
        // To balance correctness vs predictability: skip inner-program
        // collection for #each without block params.
        return;
      }

      walkProgram(b.program, locals, options, references, missingHelpers, seen);
      walkProgram(b.inverse, locals, options, references, missingHelpers, seen);
      return;
    }
    case "PartialStatement": {
      // v3.0 initial scope: do not descend into partials. The partial template
      // is registered separately; its variable requirements are not validated here.
      // Helper-style args on the partial invocation are still walked.
      const p = node as PartialStatementNode;
      for (const param of p.params) {
        collectFromExpression(
          param,
          "helper-param",
          locals,
          options,
          references,
          missingHelpers,
          seen
        );
      }
      walkHash(p.hash, locals, options, references, missingHelpers, seen);
      return;
    }
  }
}

function collectAll(
  template: string,
  options: CollectOptions
): { references: TemplateInputReference[]; missingHelpers: string[] } {
  const references: TemplateInputReference[] = [];
  const missingHelpers = new Set<string>();
  let ast: ProgramNode;
  try {
    ast = (hbs.handlebars as any).parse(template) as ProgramNode;
  } catch {
    // Invalid Handlebars syntax — bail; rendering will surface the parse error.
    return { references, missingHelpers: [] };
  }
  const seen = new Set<string>();
  walkProgram(ast, new Set(), options, references, missingHelpers, seen);
  return { references, missingHelpers: Array.from(missingHelpers) };
}

export function collectTemplateInputReferences(
  template: string,
  options: CollectOptions = {}
): TemplateInputReference[] {
  return collectAll(template, options).references;
}

export function hasInputPath(input: unknown, path: string): boolean {
  if (!input || typeof input !== "object") return false;
  let current: unknown = input;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object") return false;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return false;
    current = (current as Record<string, unknown>)[part];
  }
  return current !== undefined;
}

export function validateTemplateInputReferences(
  template: string,
  input: unknown,
  options: CollectOptions = {}
): TemplateInputValidationResult {
  const { references, missingHelpers } = collectAll(template, options);
  const missingVariables: TemplateInputReference[] = [];
  const seenMissing = new Set<string>();
  for (const ref of references) {
    if (hasInputPath(input, ref.path)) continue;
    const key = ref.path;
    if (seenMissing.has(key)) continue;
    seenMissing.add(key);
    missingVariables.push(ref);
  }
  return { references, missingVariables, missingHelpers };
}
