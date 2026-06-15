import {
  collectTemplateInputReferences,
  hasInputPath,
  validateTemplateInputReferences,
} from "./_templateValidation";

function paths(refs: { path: string }[]): string[] {
  return refs.map((r) => r.path);
}

describe("_templateValidation", () => {
  describe("collectTemplateInputReferences", () => {
    it("collects a simple mustache", () => {
      const refs = collectTemplateInputReferences("Hello {{name}}");
      expect(paths(refs)).toEqual(["name"]);
    });

    it("collects dotted paths", () => {
      const refs = collectTemplateInputReferences("{{user.firstName}}");
      expect(paths(refs)).toEqual(["user.firstName"]);
    });

    it("dedupes repeated references", () => {
      const refs = collectTemplateInputReferences("{{name}} and {{name}}");
      expect(paths(refs)).toEqual(["name"]);
    });

    it("collects helper params but not the helper name", () => {
      const refs = collectTemplateInputReferences(
        "{{formatDate createdAt}}",
        { helpers: { formatDate: () => "" } }
      );
      expect(paths(refs)).toEqual(["createdAt"]);
    });

    it("collects hash values", () => {
      const refs = collectTemplateInputReferences(
        "{{format value=user.name}}",
        { helpers: { format: () => "" } }
      );
      expect(paths(refs)).toEqual(["user.name"]);
    });

    it("collects block helper params", () => {
      const refs = collectTemplateInputReferences(
        "{{#if active}}{{name}}{{/if}}"
      );
      expect(paths(refs).sort()).toEqual(["active", "name"]);
    });

    it("collects inverse branch references", () => {
      const refs = collectTemplateInputReferences(
        "{{#unless active}}{{fallback}}{{/unless}}"
      );
      expect(paths(refs).sort()).toEqual(["active", "fallback"]);
    });

    it("collects subexpression params", () => {
      const refs = collectTemplateInputReferences(
        "{{formatDate (parseDate createdAt)}}",
        { helpers: { formatDate: () => "", parseDate: () => "" } }
      );
      expect(paths(refs)).toEqual(["createdAt"]);
    });

    it("skips known helper names", () => {
      const refs = collectTemplateInputReferences("{{#if a}}{{/if}}");
      expect(paths(refs)).toEqual(["a"]);
    });

    it("ignores string/number/boolean literals", () => {
      const refs = collectTemplateInputReferences(
        '{{formatDate "literal" 42 true}}',
        { helpers: { formatDate: () => "" } }
      );
      expect(paths(refs)).toEqual([]);
    });

    it("ignores @-prefixed data variables", () => {
      const refs = collectTemplateInputReferences(
        "{{#each items}}{{@index}}{{/each}}"
      );
      // #each without block params: only `items` collected; inner skipped
      expect(paths(refs)).toEqual(["items"]);
    });

    it("ignores @-prefixed data variables outside #each", () => {
      // {{@root}} should not be collected as input — it's a Handlebars data var.
      const refs = collectTemplateInputReferences("{{@root}}");
      expect(paths(refs)).toEqual([]);
    });

    it("ignores `this` references (empty parts)", () => {
      // Handlebars strips `this` from parts; bare {{this}} has zero parts.
      const refs = collectTemplateInputReferences("{{this}}");
      expect(paths(refs)).toEqual([]);
    });

    it("ignores parent-scope (../) paths", () => {
      // ../parent is a depth>0 reference that we don't validate against root input.
      const refs = collectTemplateInputReferences(
        "{{#each users as |user|}}{{../title}}{{/each}}"
      );
      expect(paths(refs)).toEqual(["users"]);
    });

    it("respects block params introduced by as |item|", () => {
      const refs = collectTemplateInputReferences(
        "{{#each users as |user|}}{{user.name}}{{/each}}"
      );
      expect(paths(refs)).toEqual(["users"]);
    });

    it("collects from #with body when used", () => {
      const refs = collectTemplateInputReferences(
        "{{#with user}}{{name}}{{/with}}"
      );
      // user collected as block param; inner `name` is collected because we
      // don't model #with scope changes — that's a documented limitation,
      // but for now we treat inner paths as root-level references.
      expect(paths(refs).sort()).toEqual(["name", "user"]);
    });

    it("skips bare paths inside #each without block params", () => {
      const refs = collectTemplateInputReferences(
        "{{#each items}}{{name}}{{/each}}"
      );
      expect(paths(refs)).toEqual(["items"]);
    });

    it("handles parse errors gracefully", () => {
      const refs = collectTemplateInputReferences("{{#if active}}");
      expect(refs).toEqual([]);
    });

    it("returns empty for templates with no variables", () => {
      expect(collectTemplateInputReferences("Hello world")).toEqual([]);
    });

    it("returns empty for empty string", () => {
      expect(collectTemplateInputReferences("")).toEqual([]);
    });

    it("skips this", () => {
      const refs = collectTemplateInputReferences("{{this}}");
      expect(refs).toEqual([]);
    });

    it("skips ../parent paths", () => {
      const refs = collectTemplateInputReferences(
        "{{#each items}}{{../sibling}}{{/each}}"
      );
      expect(paths(refs)).toEqual(["items"]);
    });

    it("treats unknown helper with args as missing helper", () => {
      const result = validateTemplateInputReferences(
        "{{unknownHelper createdAt}}",
        { createdAt: "x" }
      );
      expect(result.missingHelpers).toEqual(["unknownHelper"]);
      expect(result.missingVariables).toEqual([]);
    });
  });

  describe("hasInputPath", () => {
    it("returns true for present top-level value", () => {
      expect(hasInputPath({ a: 1 }, "a")).toBe(true);
    });

    it("returns false for missing top-level value", () => {
      expect(hasInputPath({}, "a")).toBe(false);
    });

    it("returns true for present nested value", () => {
      expect(hasInputPath({ a: { b: 1 } }, "a.b")).toBe(true);
    });

    it("returns false for missing nested leaf", () => {
      expect(hasInputPath({ a: {} }, "a.b")).toBe(false);
    });

    it("returns false when parent is missing", () => {
      expect(hasInputPath({}, "a.b")).toBe(false);
    });

    it("treats null as present", () => {
      expect(hasInputPath({ a: null }, "a")).toBe(true);
    });

    it("treats false as present", () => {
      expect(hasInputPath({ a: false }, "a")).toBe(true);
    });

    it("treats 0 as present", () => {
      expect(hasInputPath({ a: 0 }, "a")).toBe(true);
    });

    it("treats empty string as present", () => {
      expect(hasInputPath({ a: "" }, "a")).toBe(true);
    });

    it("treats undefined as missing", () => {
      expect(hasInputPath({ a: undefined }, "a")).toBe(false);
    });

    it("returns false for non-object input", () => {
      expect(hasInputPath(null, "a")).toBe(false);
      expect(hasInputPath(undefined, "a")).toBe(false);
      expect(hasInputPath("string", "a")).toBe(false);
      expect(hasInputPath(42, "a")).toBe(false);
    });

    it("returns false when descending into a non-object intermediate", () => {
      // a is a string, so a.length-style nesting is not traversable.
      expect(hasInputPath({ a: "string" }, "a.length")).toBe(false);
      expect(hasInputPath({ a: null }, "a.foo")).toBe(false);
    });

    it("does not traverse inherited properties", () => {
      class Parent {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inherited: any = 1;
      }
      class Child extends Parent {}
      const instance = new Child();
      // own property only
      expect(hasInputPath(instance, "inherited")).toBe(true);
      expect(hasInputPath(Object.create({ inherited: 1 }), "inherited")).toBe(
        false
      );
    });
  });

  describe("validateTemplateInputReferences", () => {
    it("returns no missing when all provided", () => {
      const result = validateTemplateInputReferences("Hello {{name}}", {
        name: "Greg",
      });
      expect(result.missingVariables).toEqual([]);
      expect(result.missingHelpers).toEqual([]);
    });

    it("returns missing top-level variable", () => {
      const result = validateTemplateInputReferences(
        "Hello {{name}}, age {{age}}",
        { name: "Greg" }
      );
      expect(paths(result.missingVariables)).toEqual(["age"]);
    });

    it("returns missing nested leaf", () => {
      const result = validateTemplateInputReferences(
        "{{user.name}}",
        { user: {} }
      );
      expect(paths(result.missingVariables)).toEqual(["user.name"]);
    });

    it("returns missing parent path", () => {
      const result = validateTemplateInputReferences("{{user.name}}", {});
      expect(paths(result.missingVariables)).toEqual(["user.name"]);
    });

    it("treats null/false/0/'' as present", () => {
      const result = validateTemplateInputReferences(
        "{{a}} {{b}} {{c}} {{d}}",
        { a: 0, b: false, c: "", d: null }
      );
      expect(result.missingVariables).toEqual([]);
    });

    it("treats undefined as missing", () => {
      const result = validateTemplateInputReferences("{{a}}", { a: undefined });
      expect(paths(result.missingVariables)).toEqual(["a"]);
    });

    it("reports missing helper and still validates its arguments", () => {
      const result = validateTemplateInputReferences(
        "{{unknownHelper createdAt}}",
        {}
      );
      expect(result.missingHelpers).toEqual(["unknownHelper"]);
      expect(paths(result.missingVariables)).toEqual(["createdAt"]);
    });

    it("dedupes missing variables", () => {
      const result = validateTemplateInputReferences(
        "{{a}} {{a}} {{a}}",
        {}
      );
      expect(paths(result.missingVariables)).toEqual(["a"]);
    });

    it("dedupes missing variables across different reference sources", () => {
      // Same path 'a' missing from both a mustache and a helper-param source —
      // collected as two distinct references (different `source`), but missing
      // variables are deduped by path.
      const result = validateTemplateInputReferences(
        "{{a}} {{formatDate a}}",
        {},
        { helpers: { formatDate: () => "" } }
      );
      expect(paths(result.missingVariables)).toEqual(["a"]);
    });

    it("does not require inner each paths without block params", () => {
      const result = validateTemplateInputReferences(
        "{{#each items}}{{name}}{{/each}}",
        { items: [] }
      );
      expect(result.missingVariables).toEqual([]);
    });

    it("does not require block-param aliases", () => {
      const result = validateTemplateInputReferences(
        "{{#each users as |user|}}{{user.name}}{{/each}}",
        { users: [] }
      );
      expect(result.missingVariables).toEqual([]);
    });

    it("returns no refs and no missing on unparseable templates", () => {
      // Mismatched/invalid handlebars syntax — parser throws and we bail.
      const result = validateTemplateInputReferences(
        "{{#if a}}no closing",
        {}
      );
      expect(result.references).toEqual([]);
      expect(result.missingHelpers).toEqual([]);
      expect(result.missingVariables).toEqual([]);
    });

    it("reports unknown helper used as block (#)", () => {
      const result = validateTemplateInputReferences(
        "{{#unknownBlock items}}{{name}}{{/unknownBlock}}",
        { items: [], name: "x" }
      );
      expect(result.missingHelpers).toEqual(["unknownBlock"]);
      expect(result.missingVariables).toEqual([]);
    });

    it("walks partial invocation params and hash", () => {
      // Partial named 'card' invoked with arg + hash. We don't recurse into the
      // partial body, but we do validate the invocation's params/hash.
      const result = validateTemplateInputReferences(
        '{{> card user title=heading}}',
        { user: { name: "a" } }
      );
      expect(paths(result.missingVariables).sort()).toEqual(["heading"]);
    });
  });
});
