import { GroupOperator, Operator } from "@decaf-ts/core";
import { CouchDBGroupOperator, CouchDBOperator } from "./constants";
import { QueryError } from "@decaf-ts/core";
import { MangoOperator } from "../types";

/**
 * @description Translates core operators to CouchDB Mango operators
 * @summary Converts Decaf.ts core operators to their equivalent CouchDB Mango query operators
 * @param {GroupOperator | Operator} operator - The core operator to translate
 * @return {MangoOperator} The equivalent CouchDB Mango operator
 * @throws {QueryError} If no translation exists for the given operator
 * @function translateOperators
 * @memberOf module:for-couchdb
 * @mermaid
 * sequenceDiagram
 *   participant Caller
 *   participant translateOperators
 *   participant CouchDBOperator
 *   participant CouchDBGroupOperator
 *   
 *   Caller->>translateOperators: operator
 *   
 *   translateOperators->>CouchDBOperator: Check for match
 *   alt Found in CouchDBOperator
 *     CouchDBOperator-->>translateOperators: Return matching operator
 *     translateOperators-->>Caller: Return MangoOperator
 *   else Not found
 *     translateOperators->>CouchDBGroupOperator: Check for match
 *     alt Found in CouchDBGroupOperator
 *       CouchDBGroupOperator-->>translateOperators: Return matching operator
 *       translateOperators-->>Caller: Return MangoOperator
 *     else Not found
 *       translateOperators-->>Caller: Throw QueryError
 *     end
 *   end
 */
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
