import { FromClause } from "@decaf-ts/core";
import { MangoQuery } from "nano";
import { Constructor, ModelArg, Model } from "@decaf-ts/decorator-validation";
import { CouchDBKeys } from "../constants";
import { CouchDBOperator } from "./constants";

// noinspection JSAnnotator
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
    selectors[CouchDBKeys.TABLE][CouchDBOperator.EQUAL] =
      typeof this.selector === "string"
        ? this.selector
        : ((this.selector as Constructor<M>).name as string);
    previous.selector = selectors;
    return previous;
  }
}
