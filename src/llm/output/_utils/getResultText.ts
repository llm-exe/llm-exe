import { OutputResult } from "@/types";
import { isOutputResultContentText } from "@/utils/guards";

export function getResultText(result: OutputResult, index?: number): string {
  if (typeof index === "number" && index > 0) {
    // options holds only the alternates: choice N lives at options[N - 1].
    const arr = result?.options || [];
    const val = arr[index - 1];
    return isOutputResultContentText(val?.[0]) ? val[0]?.text : "";
  }

  return isOutputResultContentText(result?.content?.[0])
    ? result.content[0]?.text
    : "";
}
