import { FromClause } from "@decaf-ts/core";
import { ModelArg, Model, Constructor } from "@decaf-ts/decorator-validation";
import { CouchDBKeys } from "../constants";
import { Repository } from "@decaf-ts/core";
import { MangoQuery } from "../types";

export class CouchDBFromClause<M extends Model> extends FromClause<
  MangoQuery,
  M
> {
  constructor(clause: ModelArg<FromClause<MangoQuery, M>>) {
    super(clause);
  }

  build(previous: MangoQuery): MangoQuery {
    const selectors: any = {};
    selectors[CouchDBKeys.TABLE] = {};
    selectors[CouchDBKeys.TABLE] =
      typeof this.selector === "string"
        ? this.selector
        : Repository.table(this.selector as Constructor<M>);
    previous.selector = selectors;
    return previous;
  }
}
