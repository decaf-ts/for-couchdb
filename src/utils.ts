import { OrderDirection, PersistenceKeys } from "@decaf-ts/core";
import {
  CreateIndexRequest,
  DocumentScope,
  MangoSelector,
  ServerScope,
  SortOrder,
} from "nano";
import { CouchDBKeys } from "./constants";
import { DefaultSeparator } from "@decaf-ts/db-decorators";
import { CouchDBOperator } from "./query/constants";

export async function reAuth(con: ServerScope, user: string, pass: string) {
  return con.auth(user, pass);
}

export function wrapDocumentScope(
  con: ServerScope,
  dbName: string,
  user: string,
  pass: string
): DocumentScope<any> {
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
  return db;
}

export function testReservedAttributes(attr: string) {
  const regexp = /^_.*$/g;
  return attr.match(regexp);
}

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
