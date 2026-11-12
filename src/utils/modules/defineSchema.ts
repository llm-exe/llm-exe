/**
 * Narrows an inferred type to its literal form (like `as const`).
 *
 * Mirrors `Narrow` from json-schema-to-ts. It is defined locally because that
 * type is only reachable through a deep directory import
 * (`json-schema-to-ts/lib/types/type-utils`), which ends up in our emitted
 * declarations. Under `moduleResolution: node16/nodenext` that import cannot
 * be resolved, `Narrow` degrades to `any`, and parser output types collapse
 * to `unknown` (#947).
 */
export type Narrow<INPUT> =
  INPUT extends Promise<infer AWAITED>
    ? Promise<Narrow<AWAITED>>
    : INPUT extends (...args: infer ARGS) => infer RETURN
      ? (...args: Narrow<ARGS>) => Narrow<RETURN>
      : INPUT extends []
        ? []
        : INPUT extends object
          ? { [KEY in keyof INPUT]: Narrow<INPUT[KEY]> }
          : INPUT extends string | number | boolean | bigint
            ? INPUT
            : never;

export function defineSchema<T>(obj: Narrow<T>): Narrow<T> {
  (obj as any).additionalProperties = false;
  return obj;
}
