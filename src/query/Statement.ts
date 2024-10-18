import { DocumentScope, MangoQuery } from "nano";
import { Statement } from "@decaf-ts/core";
import { Adapter } from "@decaf-ts/core";
import { findPrimaryKey, InternalError } from "@decaf-ts/db-decorators";
import { Constructor } from "@decaf-ts/decorator-validation";
import { CouchDBKeys } from "../constants";

export class CouchDBStatement extends Statement<MangoQuery> {
  constructor(db: Adapter<DocumentScope<any>, MangoQuery>) {
    super(db);
  }

  async raw<R>(rawInput: MangoQuery, ...args: any[]): Promise<R> {
    const results = await this.adapter.raw<R>(rawInput, ...args);
    if (!this.fullRecord) return results;
    if (!this.target)
      throw new InternalError(
        "No target defined in statement. should never happen",
      );

    const pkAttr = findPrimaryKey(new this.target() as any).id;

    const processor = function recordProcessor(this: CouchDBStatement, r: any) {
      if (!r[CouchDBKeys.ID])
        throw new InternalError(
          `No CouchDB Id definition found. Should not be possible`,
        );
      const [, ...keyArgs] = r[CouchDBKeys.ID].split("_");

      const id = keyArgs.join("_");
      return this.adapter.revert(
        r,
        this.target as Constructor<any>,
        pkAttr,
        id,
      ) as any;
    }.bind(this);

    if (Array.isArray(results)) return results.map(processor) as R;
    return processor(results) as R;
  }
}
