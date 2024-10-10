import { DocumentScope, ServerScope } from "nano";

export async function reAuth(con: ServerScope, user: string, pass: string) {
  return con.auth(user, pass);
}

export function wrapDocumentScope(
  con: ServerScope,
  dbName: string,
  user: string,
  pass: string,
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
