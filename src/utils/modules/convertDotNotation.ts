// Assigning these as keys walks or replaces the prototype chain instead of
// setting a plain property ("__proto__.x" pollutes Object.prototype). They can
// never be legitimate config paths, so they are dropped entirely.
const PROTOTYPE_POLLUTING_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

function isUnsafeKeyPath(key: string): boolean {
  return key.split(".").some((segment) => PROTOTYPE_POLLUTING_KEYS.has(segment));
}

export function convertDotNotation(
  obj: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {};

  // Process all non-dot notation keys first to establish base structure
  for (const key in obj) {
    if (
      Object.prototype.hasOwnProperty.call(obj, key) &&
      !key.includes(".") &&
      !PROTOTYPE_POLLUTING_KEYS.has(key)
    ) {
      result[key] = obj[key];
    }
  }

  // Then process dot notation keys
  for (const key in obj) {
    if (
      Object.prototype.hasOwnProperty.call(obj, key) &&
      key.includes(".") &&
      !isUnsafeKeyPath(key)
    ) {
      const keys = key.split(".");
      let currentLevel = result;

      for (let i = 0; i < keys.length; i++) {
        const currentKey = keys[i];
        
        if (i === keys.length - 1) {
          // Final key - set the value
          currentLevel[currentKey] = obj[key];
        } else {
          // Intermediate key - ensure it's an object
          if (!(currentKey in currentLevel)) {
            currentLevel[currentKey] = {};
          } else if (
            typeof currentLevel[currentKey] !== "object" || 
            currentLevel[currentKey] === null ||
            Array.isArray(currentLevel[currentKey])
          ) {
            // Replace non-plain objects (including arrays/null) to prevent type conflicts
            // This ensures dot notation paths can be safely created
            currentLevel[currentKey] = {};
          }
          currentLevel = currentLevel[currentKey];
        }
      }
    }
  }

  return result;
}
