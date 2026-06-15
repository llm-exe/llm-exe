import { appendContextPath } from "@/utils/modules/handlebars/utils/appendContextPath";
import { blockParams } from "@/utils/modules/handlebars/utils/blockParams";
import { isPromise } from "@/utils/modules/isPromise";
import { createFrame } from "@/utils/modules/handlebars/utils/createFrame";
import { isReadableStream } from "@/utils/modules/isReadableStream";
import { LlmExeError } from "@/errors";

export async function eachFnAsync(this: any, arg1: any, options: any) {
  if (!options) {
    throw new LlmExeError("Must pass iterator to #each", {
      code: "template.invalid_helper_arguments",
      context: {
        operation: "handlebars.asyncHelper.each",
        helper: "each",
        expected: "an iterator",
        received: typeof options,
      },
    });
  }

  const { fn } = options;
  const { inverse } = options;

  let i = 0;
  let data: {
    key?: any;
    index?: number;
    first?: boolean;
    last?: boolean;
    contextPath?: string;
  } = {};

  let ret: ((...args: any[]) => Promise<any>)[] = [];
  let contextPath = "";

  if (options.data && options.ids) {
    contextPath = `${appendContextPath(
      options.data.contextPath,
      options.ids[0]
    )}.`;
  }

  if (typeof arg1 === "function") {
    arg1 = arg1.call(this);
  }

  if (options.data) {
    data = createFrame(options.data);
  }

  async function execIteration(
    field: string | number,
    index: number,
    last?: boolean
  ) {
    if (data) {
      data.key = field;
      data.index = index;
      data.first = index === 0;
      data.last = !!last;

      if (contextPath) {
        data.contextPath = contextPath + field;
      }
    }

    ret.push(
      await fn(arg1[field], {
        data,
        blockParams: blockParams(
          [arg1[field], field],
          [contextPath + field, null]
        ),
      })
    );
  }

  if (isPromise(arg1)) {
    arg1 = await arg1;
  }

  if (arg1 && typeof arg1 === "object") {
    if (Array.isArray(arg1)) {
      for (let j = arg1.length; i < j; i++) {
        if (i in arg1) {
          await execIteration(i, i, i === arg1.length - 1);
        }
      }
    } else if (global.Symbol && arg1[global.Symbol.iterator]) {
      const newContext = [],
        iterator = arg1[global.Symbol.iterator]();
      for (let it = iterator.next(); !it.done; it = iterator.next()) {
        newContext.push(it.value);
      }
      arg1 = newContext;
      for (let j = arg1.length; i < j; i++) {
        await execIteration(i, i, i === arg1.length - 1);
      }
    } else if (isReadableStream(arg1)) {
      const newContext: any[] = [];
      await new Promise((resolve, reject) => {
        arg1
          .on("data", (item: any) => {
            newContext.push(item);
          })
          .on("end", async () => {
            arg1 = newContext;
            for (let j = arg1.length; i < j; i++) {
              await execIteration(i, i, i === arg1.length - 1);
            }
            resolve(true);
          })
          .once("error", (e: any) => reject(e));
      });
    } else {
      let priorKey;

      for (const key of Object.keys(arg1)) {
        // We're running the iterations one step out of sync so we can detect
        // the last iteration without have to scan the object twice and create
        // an itermediate keys array.
        if (priorKey !== undefined) {
          await execIteration(priorKey, i - 1);
        }
        priorKey = key;
        i++;
      }
      if (priorKey !== undefined) {
        await execIteration(priorKey, i - 1, true);
      }
    }
  }

  if (i === 0) {
    ret = inverse(this);
    ret = [inverse(this)];
  }

  return ret.join("");
}
