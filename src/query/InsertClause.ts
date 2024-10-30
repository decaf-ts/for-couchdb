import { InsertClause } from "@decaf-ts/core";
import { ModelArg, Model } from "@decaf-ts/decorator-validation";
import { InternalError } from "@decaf-ts/db-decorators";
import { MangoQuery } from "../types";

// noinspection JSAnnotator
export class CouchDBInsertClause<M extends Model> extends InsertClause<
  MangoQuery,
  M
> {
  constructor(clause: ModelArg<InsertClause<MangoQuery, M>>) {
    super(clause);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  build(query: MangoQuery): MangoQuery {
    throw new InternalError("Not supported");
  }
}
