import { DocumentScope, MangoQuery } from "nano";
import { Statement } from "@decaf-ts/core";
import { Adapter } from "@decaf-ts/core";

export class CouchDBStatement extends Statement<MangoQuery> {
  constructor(db: Adapter<DocumentScope<any>, MangoQuery>) {
    super(db);
  }
}
