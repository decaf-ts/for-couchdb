import { ValuesClause } from "@decaf-ts/core";
import { MangoQuery } from "nano";
import { ModelArg, Model } from "@decaf-ts/decorator-validation";
import { InternalError } from "@decaf-ts/db-decorators";

export class CouchDBValuesClause<M extends Model> extends ValuesClause<
  MangoQuery,
  M
> {
  constructor(clause: ModelArg<ValuesClause<MangoQuery, M>>) {
    super(clause);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  build(previous: MangoQuery): MangoQuery {
    throw new InternalError("Not implemented");
  }
}
