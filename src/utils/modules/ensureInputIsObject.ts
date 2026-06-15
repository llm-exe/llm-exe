import { ObjectArray, PlainObject } from "@/interfaces";

/**
 * Coerces non-object inputs into a `{ input: value }` envelope.
 *
 * - Plain objects pass through unchanged.
 * - Arrays, strings, numbers, `null`, and `undefined` are wrapped as
 *   `{ input: value }`.
 *
 * Used internally by {@link BaseExecutor.getHandlerInput} and by tool/function
 * callables, which forward raw arguments from tool calls into an executor.
 * Public executor calls reject `null` and `undefined` before this helper is
 * reached; direct helper callers may still use its wrapping behavior.
 */
export function ensureInputIsObject<T extends ObjectArray>(
  input: T
): { input: T };
export function ensureInputIsObject<T>(input: number[]): { input: number[] };
export function ensureInputIsObject<T>(input: string[]): { input: string[] };
export function ensureInputIsObject<T>(input: string): { input: string };
export function ensureInputIsObject<T>(input: number): { input: number };
export function ensureInputIsObject<T extends PlainObject>(input: T): T;
export function ensureInputIsObject<T>(input: any): PlainObject | { input: T } {
  if (input === null || typeof input === "undefined") {
    return { input: input };
  }
  switch (typeof input) {
    case "object": {
      if (Array.isArray(input)) {
        return { input: input };
      }
      return input;
    }
    default:
      return { input: input };
  }
}
