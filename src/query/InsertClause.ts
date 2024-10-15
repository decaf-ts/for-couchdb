import { InsertClause } from "@decaf-ts/core";
import { MangoQuery } from "nano";
import { DBModel } from "@decaf-ts/db-decorators";
import { ModelArg } from "@decaf-ts/decorator-validation";
import { InternalError } from "@decaf-ts/db-decorators";

// noinspection JSAnnotator
export class CouchDBInsertClause<M extends DBModel> extends InsertClause<
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
