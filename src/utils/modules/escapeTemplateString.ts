export function escapeTemplateString(input: string): string {
  if (typeof input !== "string") return input;
  return input.replace(/\{\{/g, "\\{{");
}
