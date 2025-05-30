import { OrderDirection, PersistenceKeys } from "@decaf-ts/core";
import { CouchDBKeys } from "./constants";
import { DefaultSeparator } from "@decaf-ts/db-decorators";
import { CouchDBOperator } from "./query/constants";
import { CreateIndexRequest, MangoSelector, SortOrder } from "./types";

/**
 * @description Re-authenticates a connection to CouchDB
 * @summary Refreshes the authentication for a CouchDB connection using the provided credentials
 * @param {any} con - The CouchDB connection object
 * @param {string} user - The username for authentication
 * @param {string} pass - The password for authentication
 * @return {Promise<any>} A promise that resolves to the authentication result
 * @function reAuth
 * @memberOf module:for-couchdb
 */
export async function reAuth(con: any, user: string, pass: string) {
  return con.auth(user, pass);
}

/**
 * @description Wraps a CouchDB database connection with automatic re-authentication
 * @summary Creates a proxy around a CouchDB database connection that automatically re-authenticates before each operation
 * @param {any} con - The CouchDB connection object
 * @param {string} dbName - The name of the database to use
 * @param {string} user - The username for authentication
 * @param {string} pass - The password for authentication
 * @return {any} The wrapped database connection object
 * @function wrapDocumentScope
 * @memberOf module:for-couchdb
 * @mermaid
 * sequenceDiagram
 *   participant Client
 *   participant wrapDocumentScope
 *   participant DB
 *   participant reAuth
 *   
 *   Client->>wrapDocumentScope: con, dbName, user, pass
 *   wrapDocumentScope->>DB: con.use(dbName)
 *   Note over wrapDocumentScope: Wrap DB methods with re-auth
 *   
 *   loop For each method (insert, get, put, destroy, find)
 *     wrapDocumentScope->>wrapDocumentScope: Store original method
 *     wrapDocumentScope->>wrapDocumentScope: Define new method with re-auth
 *   end
 *   
 *   wrapDocumentScope->>wrapDocumentScope: Add NATIVE property with con value
 *   wrapDocumentScope-->>Client: Return wrapped DB
 *   
 *   Note over Client: Later when client uses DB methods
 *   Client->>DB: Any wrapped method call
 *   DB->>reAuth: Authenticate before operation
 *   reAuth-->>DB: Authentication complete
 *   DB->>DB: Call original method
 *   DB-->>Client: Return result
 */
export function wrapDocumentScope(
  con: any,
  dbName: string,
  user: string,
  pass: string
): any {
  const db = con.use(dbName);
  ["insert", "get", "put", "destroy", "find"].forEach((k) => {
    const original = (db as Record<string, any>)[k];
    Object.defineProperty(db, k, {
      enumerable: false,
      configurable: true,
      value: async (...args: any[]) => {
        await reAuth(con, user, pass);
        return original.call(db, ...args);
      },
    });
  });
  Object.defineProperty(db, CouchDBKeys.NATIVE, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: con,
  });
  return db;
}

/**
 * @description Tests if an attribute name is reserved in CouchDB
 * @summary Checks if an attribute name starts with an underscore, which indicates it's a reserved attribute in CouchDB
 * @param {string} attr - The attribute name to test
 * @return {RegExpMatchArray|null} The match result or null if no match
 * @function testReservedAttributes
 * @memberOf module:for-couchdb
 */
export function testReservedAttributes(attr: string) {
  const regexp = /^_.*$/g;
  return attr.match(regexp);
}

/**
 * @description Generates a name for a CouchDB index
 * @summary Creates a standardized name for a CouchDB index based on the table, attribute, compositions, and order
 * @param {string} attribute - The primary attribute for the index
 * @param {string} tableName - The name of the table
 * @param {string[]} [compositions] - Optional additional attributes to include in the index
 * @param {OrderDirection} [order] - Optional sort order for the index
 * @param {string} [separator=DefaultSeparator] - The separator to use between parts of the index name
 * @return {string} The generated index name
 * @function generateIndexName
 * @memberOf module:for-couchdb
 */
export function generateIndexName(
  attribute: string,
  tableName: string,
  compositions?: string[],
  order?: OrderDirection,
  separator = DefaultSeparator
): string {
  const attr = [PersistenceKeys.INDEX, tableName, attribute];
  if (compositions) attr.push(...compositions);
  if (order) attr.push(order);
  return attr.join(separator);
}

/**
 * @description Generates a CouchDB index configuration
 * @summary Creates a complete CreateIndexRequest object for defining a CouchDB index based on specified parameters
 * @param {string} attribute - The primary attribute for the index
 * @param {string} tableName - The name of the table
 * @param {string[]} [compositions] - Optional additional attributes to include in the index
 * @param {OrderDirection} [order] - Optional sort order for the index
 * @param {string} [separator=DefaultSeparator] - The separator to use between parts of the index name
 * @return {CreateIndexRequest} The complete index configuration object
 * @function generateIndexDoc
 * @memberOf module:for-couchdb
 * @mermaid
 * sequenceDiagram
 *   participant Caller
 *   participant generateIndexDoc
 *   participant generateIndexName
 *   
 *   Caller->>generateIndexDoc: attribute, tableName, compositions, order, separator
 *   
 *   Note over generateIndexDoc: Create partial filter selector
 *   generateIndexDoc->>generateIndexDoc: Set up filter for tableName
 *   
 *   alt order is specified
 *     Note over generateIndexDoc: Create ordered fields array
 *     generateIndexDoc->>generateIndexDoc: Create orderProp for attribute
 *     generateIndexDoc->>generateIndexDoc: Map compositions to ordered props
 *     generateIndexDoc->>generateIndexDoc: Create sortedTable for table field
 *     generateIndexDoc->>generateIndexDoc: Combine all ordered fields
 *   else
 *     Note over generateIndexDoc: Create simple fields array
 *     generateIndexDoc->>generateIndexDoc: Use attribute, compositions, and table as strings
 *   end
 *   
 *   generateIndexDoc->>generateIndexName: Generate index name
 *   generateIndexName-->>generateIndexDoc: Return name
 *   
 *   Note over generateIndexDoc: Create final index request
 *   generateIndexDoc-->>Caller: Return CreateIndexRequest
 */
export function generateIndexDoc(
  attribute: string,
  tableName: string,
  compositions?: string[],
  order?: OrderDirection,
  separator = DefaultSeparator
): CreateIndexRequest {
  const partialFilterSelector: MangoSelector = {};
  partialFilterSelector[CouchDBKeys.TABLE] = {} as MangoSelector;
  (partialFilterSelector[CouchDBKeys.TABLE] as MangoSelector)[
    CouchDBOperator.EQUAL
  ] = tableName;
  let fields: SortOrder[];
  if (order) {
    const orderProp: SortOrder = {};
    orderProp[attribute] = order as "asc" | "desc";
    const sortedCompositions: SortOrder[] = (compositions || []).map((c) => {
      const r: SortOrder = {};
      r[c] = order as "asc" | "desc";
      return r;
    });
    const sortedTable: SortOrder = {};
    sortedTable[CouchDBKeys.TABLE] = order as "asc" | "desc";
    fields = [orderProp, ...sortedCompositions, sortedTable];
  } else {
    fields = [attribute, ...(compositions || []), CouchDBKeys.TABLE];
  }
  const name = generateIndexName(
    attribute,
    tableName,
    compositions,
    order,
    separator
  );
  return {
    index: {
      fields: fields,
      // partial_filter_selector: partialFilterSelector,
    },
    ddoc: [name, CouchDBKeys.DDOC].join(separator),
    name: name,
  };
}
