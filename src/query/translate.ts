import { GroupOperator, Operator } from "@decaf-ts/core";
import { CouchDBGroupOperator, CouchDBOperator } from "./constants";
import { QueryError } from "@decaf-ts/core";
import { MangoOperator } from "nano";

export function translateOperators(
  operator: GroupOperator | Operator
): MangoOperator {
  for (const operators of [CouchDBOperator, CouchDBGroupOperator]) {
    const el = Object.keys(operators).find((k) => k === operator);
    if (el) return operators[el];
  }
  throw new QueryError(
    `Could not find adapter translation for operator ${operator}`
  );
}
