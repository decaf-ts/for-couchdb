import { CouchDBGroupOperator, CouchDBOperator } from "./constants";
import { MangoSelector } from "../types";

export type EqualityFilters = Record<string, any>;

export function extractEqualityFilters(
  selector?: MangoSelector
): EqualityFilters | undefined {
  if (!selector) return undefined;
  const filters: EqualityFilters = {};
  if (!collectEqualityFilters(selector, filters)) return undefined;
  return filters;
}

function collectEqualityFilters(
  node: MangoSelector,
  target: EqualityFilters
): boolean {
  for (const [key, value] of Object.entries(node || {})) {
    if (key === CouchDBGroupOperator.AND) {
      if (!Array.isArray(value)) return false;
      if (!value.every((entry) => collectEqualityFilters(entry, target)))
        return false;
      continue;
    }
    if (key === CouchDBGroupOperator.OR) return false;
    if (typeof value === "undefined") return false;
    const eqValue = extractEqualityValue(value);
    if (typeof eqValue === "undefined") return false;
    if (
      Object.prototype.hasOwnProperty.call(target, key) &&
      target[key] !== eqValue
    )
      return false;
    target[key] = eqValue;
  }
  return true;
}

function extractEqualityValue(value: any): any | undefined {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return value;
  const keys = Object.keys(value);
  if (keys.length !== 1) return undefined;
  if (keys[0] !== CouchDBOperator.EQUAL) return undefined;
  return value[CouchDBOperator.EQUAL];
}
