import { toNumber } from "./toNumber";
import { get } from "./get";

function isObject(obj: any) {
  return obj === Object(obj);
}

function getType(schemaType: any) {
  if (!Array.isArray(schemaType)) {
    return schemaType;
  }

  // the type is an array of types instead
  // grab the first non-null type as validator (e.g. ['object', 'null'])
  var typeArray = schemaType;
  for (var i = 0; i < typeArray.length; i++) {
    var type = typeArray[i];
    if (type !== "null") {
      return type;
    }
  }
}

export function filterObjectOnSchema(
    schema: any,
    doc: any,
    detach?: any,
    property?: string
  ) {
    let result: any; // returns the resulting filtered thing from this level; can be object, array, literal, ...
  
    // if the document is null/undefined, short-circuit and return it
    if (doc === null || doc === undefined) {
      return doc;
    }
  
    // otherwise, let's build the result based on casework
    var type = getType(schema.type);
    if (type === "object" && isObject(doc) && schema.properties) {
      result = {}; // holds filtered set of object key/values from this level
  
      // process properties recursively
      Object.keys(schema.properties).forEach(function (key) {
        var child = doc[key];
        var sp = schema.properties[key];
  
        var filteredChild = filterObjectOnSchema(sp, child, detach, property);
  
        if (property) {
          result[key] = get(sp, property, "");
        } else {
          if (filteredChild === undefined) {
            if (typeof sp?.default !== "undefined") {
              // add default value if undefined and has default
              result[key] = get(sp, "default", "");
            } else {
              // filter out if the child is undefined and no default
              return;
            }
          } else {
            // keep the child if it's defined properly or null
            var childType = getType(sp.type);
            if (childType === "integer" || childType === "number") {
              result[key] = toNumber(filteredChild);
            } else if (childType === "boolean") {
              if (typeof filteredChild === "string") {
                const normalized = filteredChild.trim().toLowerCase();
                if (normalized === "true") {
                  result[key] = true;
                } else if (normalized === "false") {
                  result[key] = false;
                } else {
                  result[key] = filteredChild;
                }
              } else {
                result[key] = filteredChild;
              }
            } else {
              result[key] = filteredChild;
            }
          }
        }
      });
    } else if (type === "object" && isObject(doc) && detach) {
      return {};
    } else if (type === "array" && Array.isArray(doc) && schema.items) {
      // check that the doc is also an array
      result = [];
      doc.forEach(function (item) {
        result.push(filterObjectOnSchema(schema.items, item, detach, property));
      });
    } else {
      // literals, or if object/array schema def. vs real thing doesn't match
      result = doc;
    }
  
    return result;
  }
