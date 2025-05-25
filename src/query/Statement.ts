import {
  Condition,
  GroupOperator,
  Operator,
  OrderDirection,
  Paginator,
  Repository,
  Sequence,
  Statement,
} from "@decaf-ts/core";
import { MangoOperator, MangoQuery, MangoSelector } from "../types";
import { Model } from "@decaf-ts/decorator-validation";
import { CouchDBAdapter } from "../adapter";
import { translateOperators } from "./translate";
import { CouchDBKeys } from "../constants";
import {
  CouchDBGroupOperator,
  CouchDBOperator,
  CouchDBQueryLimit,
} from "./constants";
import { CouchDBPaginator } from "./Paginator";
import { findPrimaryKey, InternalError } from "@decaf-ts/db-decorators";

export class CouchDBStatement<M extends Model, R> extends Statement<
  MangoQuery,
  M,
  R
> {
  constructor(adapter: CouchDBAdapter<any, any, any>) {
    super(adapter);
  }

  protected build(): MangoQuery {
    const selectors: MangoSelector = {};
    selectors[CouchDBKeys.TABLE] = {};
    selectors[CouchDBKeys.TABLE] = Repository.table(this.fromSelector);
    const query: MangoQuery = { selector: selectors };
    if (this.selectSelector) query.fields = this.selectSelector as string[];

    if (this.whereCondition) {
      const condition: MangoSelector = this.parseCondition(
        Condition.and(
          this.whereCondition,
          Condition.attribute<M>(CouchDBKeys.TABLE as keyof M).eq(
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
              `A ${key} query param is about to be overridden: ${query.selector[key]} by ${val}`
            );
          query.selector[key] = val;
        });
      }
    }

    if (this.orderBySelector) {
      query.sort = query.sort || [];
      query.selector = query.selector || ({} as MangoSelector);
      const [selector, value] = this.orderBySelector as [
        string,
        OrderDirection,
      ];
      const rec: any = {};
      rec[selector] = value;
      (query.sort as any[]).push(rec as any);
      if (!query.selector[selector]) {
        query.selector[selector] = {} as MangoSelector;
        (query.selector[selector] as MangoSelector)[CouchDBOperator.BIGGER] =
          null;
      }
    }

    if (this.limitSelector) {
      query.limit = this.limitSelector;
    } else {
      console.warn(
        `No limit selector defined. Using default couchdb limit of ${CouchDBQueryLimit}`
      );
      query.limit = CouchDBQueryLimit;
    }

    if (this.offsetSelector) query.skip = this.offsetSelector;

    return query;
  }

  async paginate<R>(size: number): Promise<Paginator<M, R, MangoQuery>> {
    try {
      const query: MangoQuery = this.build();
      return new CouchDBPaginator(
        this.adapter as any,
        query,
        size,
        this.fromSelector
      );
    } catch (e: any) {
      throw new InternalError(e);
    }
  }

  private processRecord(
    r: any,
    pkAttr: keyof M,
    sequenceType: "Number" | "BigInt" | undefined
  ) {
    if (r[CouchDBKeys.ID]) {
      const [, ...keyArgs] = r[CouchDBKeys.ID].split(CouchDBKeys.SEPARATOR);

      const id = keyArgs.join("_");
      return this.adapter.revert(
        r,
        this.fromSelector,
        pkAttr,
        Sequence.parseValue(sequenceType, id)
      );
    }
    return r;
  }

  override async raw<R>(rawInput: MangoQuery): Promise<R> {
    const results: any[] = await this.adapter.raw(rawInput, true);

    const pkDef = findPrimaryKey(new this.fromSelector());
    const pkAttr = pkDef.id;
    const type = pkDef.props.type;

    if (!this.selectSelector)
      return results.map((r) => this.processRecord(r, pkAttr, type)) as R;
    return results as R;
  }

  protected parseCondition(condition: Condition<M>): MangoQuery {
    function merge(
      op: MangoOperator,
      obj1: MangoSelector,
      obj2: MangoSelector
    ): MangoQuery {
      const result: MangoQuery = { selector: {} as MangoSelector };
      result.selector[op] = [obj1, obj2];
      return result;
    }

    const { attr1, operator, comparison } = condition as unknown as {
      attr1: string | Condition<M>;
      operator: Operator | GroupOperator;
      comparison: any;
    };

    let op: MangoSelector = {} as MangoSelector;
    if (
      [GroupOperator.AND, GroupOperator.OR, Operator.NOT].indexOf(
        operator as GroupOperator
      ) === -1
    ) {
      op[attr1 as string] = {} as MangoSelector;
      (op[attr1 as string] as MangoSelector)[translateOperators(operator)] =
        comparison;
    } else if (operator === Operator.NOT) {
      op = this.parseCondition(attr1 as Condition<M>).selector as MangoSelector;
      op[translateOperators(Operator.NOT)] = {} as MangoSelector;
      (op[translateOperators(Operator.NOT)] as MangoSelector)[
        (attr1 as unknown as { attr1: string }).attr1
      ] = comparison;
    } else {
      const op1: any = this.parseCondition(attr1 as Condition<M>).selector;
      const op2: any = this.parseCondition(comparison as Condition<M>).selector;
      op = merge(translateOperators(operator), op1, op2).selector;
    }

    return { selector: op };
  }
}
