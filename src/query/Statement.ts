import { DocumentScope, MangoQuery } from "nano";
import { Adapter, Statement } from "@decaf-ts/core";
import { findPrimaryKey, InternalError } from "@decaf-ts/db-decorators";
import { Constructor } from "@decaf-ts/decorator-validation";
import { CouchDBKeys } from "../constants";
import { parseSequenceValue } from "../sequences/utils";
import { Paginator } from "@decaf-ts/core";
import { CouchDBPaginator } from "./Paginator";

export class CouchDBStatement extends Statement<MangoQuery> {
  constructor(adapter: Adapter<DocumentScope<any>, MangoQuery>) {
    super(adapter);
  }

  /**
   * @inheritDoc
   */
  async execute<Y>(): Promise<Y> {
    try {
      const query: MangoQuery = this.build();
      if (!query.limit) query.limit = Number.MAX_SAFE_INTEGER;
      return this.raw(query);
    } catch (e: any) {
      throw new InternalError(e);
    }
  }

  async paginate<R>(size: number): Promise<Paginator<R, MangoQuery>> {
    try {
      const query: MangoQuery = this.build();
      return new CouchDBPaginator(this, size, query);
    } catch (e: any) {
      throw new InternalError(e);
    }
  }

  private processRecord(
    r: any,
    pkAttr: string,
    sequenceType: "Number" | "BigInt" | undefined
  ) {
    if (!r[CouchDBKeys.ID])
      throw new InternalError(
        `No CouchDB Id definition found. Should not be possible`
      );
    const [, ...keyArgs] = r[CouchDBKeys.ID].split("_");

    const id = keyArgs.join("_");
    return this.adapter.revert(
      r,
      this.target as Constructor<any>,
      pkAttr,
      parseSequenceValue(sequenceType, id)
    ) as any;
  }

  async raw<R>(rawInput: MangoQuery, ...args: any[]): Promise<R> {
    const results = await this.adapter.raw<R>(rawInput, true, ...args);
    if (!this.fullRecord) return results;
    if (!this.target)
      throw new InternalError(
        "No target defined in statement. should never happen"
      );

    const pkDef = findPrimaryKey(new this.target() as any);
    const pkAttr = pkDef.id;
    const type = pkDef.props.type;
    if (Array.isArray(results))
      return results.map((r) => this.processRecord(r, pkAttr, type)) as R;
    return this.processRecord(results, pkAttr, type) as R;
  }
}
