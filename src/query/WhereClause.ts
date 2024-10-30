import { Condition, WhereClause } from "@decaf-ts/core";
import { ModelArg } from "@decaf-ts/decorator-validation";
import { CouchDBGroupOperator } from "./constants";
import { sf } from "@decaf-ts/decorator-validation";
import { CouchDBKeys } from "../constants";
import { MangoOperator, MangoQuery, MangoSelector } from "../types";

export class CouchDBWhereClause extends WhereClause<MangoQuery> {
  constructor(clause: ModelArg<WhereClause<MangoQuery>>) {
    super(clause);
  }

  build(query: MangoQuery): MangoQuery {
    const condition: MangoSelector = this.adapter.parseCondition(
      Condition.and(
        this.condition as Condition,
        Condition.attribute(CouchDBKeys.TABLE).eq(
          query.selector[CouchDBKeys.TABLE]
        )
      )
    ).selector;

    const selectorKeys = Object.keys(condition) as MangoOperator[];
    if (
      selectorKeys.length === 1 &&
      Object.values(CouchDBGroupOperator).indexOf(selectorKeys[0]) !== -1
    )
      switch (selectorKeys[0]) {
        case CouchDBGroupOperator.AND:
          condition[CouchDBGroupOperator.AND] = [
            ...Object.values(
              condition[CouchDBGroupOperator.AND] as MangoSelector
            ).reduce((accum: MangoSelector[], val: any) => {
              const keys = Object.keys(val);
              if (keys.length !== 1)
                throw new Error(
                  "Too many keys in query selector. should be one"
                );
              const k = keys[0];
              if (k === CouchDBGroupOperator.AND)
                accum.push(...(val[k] as any[]));
              else accum.push(val);
              return accum;
            }, []),
          ];
          query.selector = condition;
          break;
        case CouchDBGroupOperator.OR: {
          const s: Record<any, any> = {};
          s[CouchDBGroupOperator.AND] = [
            condition,
            ...Object.entries(query.selector).map(([key, val]) => {
              const result: Record<any, any> = {};
              result[key] = val;
              return result;
            }),
          ];
          query.selector = s;
          break;
        }
        default:
          throw new Error("This should be impossible");
      }
    else {
      Object.entries(condition).forEach(([key, val]) => {
        if (query.selector[key])
          console.warn(
            sf(
              "A {0} query param is about to be overridden: {1} by {2}",
              key,
              query.selector[key] as unknown as string,
              val as unknown as string
            )
          );
        query.selector[key] = val;
      });
    }

    return query;
  }
}
