import { isUndefined } from "../../isUndefined";
import { isNull } from "../../isNull";
import { LlmExeError } from "@/errors";

export function removeEmptyFromObject<T extends Record<string, any>>(
    obj: T
  ): T {
    if(typeof obj !== "object" || obj === null) {
        throw new LlmExeError("invalid object", {
          code: "template.invalid_helper_arguments",
          context: {
            operation: "removeEmptyFromObject",
            expected: "object",
            received: obj === null ? "null" : typeof obj,
          },
        });
    }

    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => !isNull(v) && !isUndefined(v))
    ) as T;
  }