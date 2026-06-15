import { JSONSchema, FromSchema } from "json-schema-to-ts";
import { filterObjectOnSchema } from "@/utils/modules/filterObjectOnSchema";
import { validate as validateSchema } from "jsonschema";

function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function getSchemaType(schemaType: any) {
  if (!Array.isArray(schemaType)) {
    return schemaType;
  }

  return schemaType.find((type) => type !== "null");
}

export function enforceParserSchema<
  S extends JSONSchema | undefined = undefined,
  T = S extends JSONSchema ? FromSchema<S> : Record<string, any>
>(schema: S, parsed: T): T {
  if (!schema || !parsed || typeof parsed !== "object") {
    return parsed as T;
  }
  return filterObjectOnSchema(schema, parsed) as T;
}

export function validateParserSchema<
  S extends JSONSchema,
  T extends Record<string, any>
>(schema: S, parsed: T) {
  if (!schema || !parsed || typeof parsed !== "object") {
    return null;
  }
  const validate = validateSchema(parsed, schema);

  if (validate.errors.length) {
    return validate.errors;
  }

  return null;
}

export function coerceParserSchemaValues<
  S extends JSONSchema | undefined = undefined,
  T = S extends JSONSchema ? FromSchema<S> : Record<string, any>
>(schema: S, parsed: T): T {
  if (!schema || parsed === null || typeof parsed === "undefined") {
    return parsed as T;
  }

  const type = getSchemaType((schema as any).type);

  if (type === "object" && isPlainObject(parsed)) {
    const properties = (schema as any).properties || {};
    return Object.keys(parsed as Record<string, any>).reduce((output, key) => {
      const propertySchema = properties[key];
      output[key] = propertySchema
        ? coerceParserSchemaValues(propertySchema, (parsed as any)[key])
        : (parsed as any)[key];
      return output;
    }, {} as Record<string, any>) as T;
  }

  if (type === "array" && Array.isArray(parsed) && (schema as any).items) {
    return parsed.map((item) =>
      coerceParserSchemaValues((schema as any).items, item)
    ) as T;
  }

  if ((type === "number" || type === "integer") && typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (trimmed !== "") {
      const value = Number(trimmed);
      if (Number.isFinite(value)) {
        return value as T;
      }
    }
  }

  if (type === "boolean" && typeof parsed === "string") {
    const normalized = parsed.trim().toLowerCase();
    if (normalized === "true") {
      return true as T;
    }
    if (normalized === "false") {
      return false as T;
    }
  }

  return parsed as T;
}

export function applyParserSchemaDefaultsAndFilter<
  S extends JSONSchema | undefined = undefined,
  T = S extends JSONSchema ? FromSchema<S> : Record<string, any>
>(schema: S, parsed: T): T {
  if (!schema || parsed === null || typeof parsed === "undefined") {
    return parsed as T;
  }

  const type = getSchemaType((schema as any).type);

  if (type === "object" && isPlainObject(parsed)) {
    const properties = (schema as any).properties;
    if (!properties) {
      return parsed as T;
    }

    const keepAdditionalProperties = (schema as any).additionalProperties !== false;
    const initialOutput = keepAdditionalProperties
      ? { ...(parsed as Record<string, any>) }
      : {};

    return Object.keys(properties).reduce((output, key) => {
      const propertySchema = properties[key];
      const value = (parsed as any)[key];

      if (typeof value === "undefined") {
        if (typeof propertySchema?.default !== "undefined") {
          output[key] = propertySchema.default;
        }
        return output;
      }

      output[key] = applyParserSchemaDefaultsAndFilter(propertySchema, value);
      return output;
    }, initialOutput as Record<string, any>) as T;
  }

  if (type === "array" && Array.isArray(parsed) && (schema as any).items) {
    return parsed.map((item) =>
      applyParserSchemaDefaultsAndFilter((schema as any).items, item)
    ) as T;
  }

  return parsed as T;
}
