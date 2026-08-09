export function replaceTemplateStringSimple(
  template: string,
  context: Record<string, any>,
  opts?: { encodeKeys?: string[] }
): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key) => {
    const keys = key.split(".");
    let value: any = context;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return "";
      }
    }

    const str = typeof value === "string" ? value : String(value);

    // URL-encode only the placeholders the caller marks (e.g. a model id used as
    // a path segment) so an ARN model id's ":" and "/" don't break the request
    // path (they otherwise add extra segments and the route 404s). Applied
    // per-key so full-URL placeholders like {{baseUrl}} are never mangled, and
    // never to header interpolation (which would corrupt API keys).
    return opts?.encodeKeys?.includes(key) ? encodeURIComponent(str) : str;
  });
}
