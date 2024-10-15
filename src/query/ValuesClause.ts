import { ValuesClause } from "@decaf-ts/core";
import { MangoQuery } from "nano";
import { DBModel } from "@decaf-ts/db-decorators";
import { ModelArg } from "@decaf-ts/decorator-validation";
import { InternalError } from "@decaf-ts/db-decorators";

export class CouchDBValuesClause<M extends DBModel> extends ValuesClause<
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
