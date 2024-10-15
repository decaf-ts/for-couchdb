import { SelectClause } from "@decaf-ts/core";
import { MangoQuery } from "nano";
import { DBModel } from "@decaf-ts/db-decorators";
import { ModelArg } from "@decaf-ts/decorator-validation";

export class CouchDBSelectClause<M extends DBModel> extends SelectClause<
  MangoQuery,
  M
> {
  constructor(clause: ModelArg<SelectClause<MangoQuery, M>>) {
    super(clause);
  }

  build(query: MangoQuery): MangoQuery {
    if (!this.selector) return query;
    query.fields =
      typeof this.selector === "string"
        ? [this.selector as string]
        : (this.selector as string[]);
    return query;
  }
}
