import { Const, SelectClause } from "@decaf-ts/core";
import { MangoQuery } from "nano";
import { ModelArg, Model } from "@decaf-ts/decorator-validation";

export class CouchDBSelectClause<M extends Model> extends SelectClause<
  MangoQuery,
  M
> {
  constructor(clause: ModelArg<SelectClause<MangoQuery, M>>) {
    super(clause);
  }

  build(query: MangoQuery): MangoQuery {
    if (!this.selector || this.selector === Const.FULL_RECORD) return query;
    query.fields =
      typeof this.selector === "string"
        ? [this.selector as string]
        : (this.selector as string[]);
    return query;
  }
}
