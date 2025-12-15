import {
  Condition,
  GroupOperator,
  Operator,
  OrderDirection,
  Sequence,
  Statement,
} from "@decaf-ts/core";
import { MangoOperator, MangoQuery, MangoSelector } from "../types";
import { Model } from "@decaf-ts/decorator-validation";
import { translateOperators } from "./translate";
import { CouchDBKeys } from "../constants";
import {
  CouchDBGroupOperator,
  CouchDBOperator,
  CouchDBQueryLimit,
} from "./constants";
import { DBKeys } from "@decaf-ts/db-decorators";
import type { Context } from "@decaf-ts/db-decorators";
import { Metadata } from "@decaf-ts/decoration";
import { Adapter } from "@decaf-ts/core";

/**
 * @description Statement builder for CouchDB Mango queries
 * @summary Provides a fluent interface for building CouchDB Mango queries with type safety
 * @template M - The model type that extends Model
 * @template R - The result type
 * @param adapter - The CouchDB adapter
 * @class CouchDBStatement
 * @example
 * // Example of using CouchDBStatement
 * const adapter = new MyCouchDBAdapter(scope);
 * const statement = new CouchDBStatement<User, User[]>(adapter);
 *
 * // Build a query
 * const users = await statement
 *   .from(User)
 *   .where(Condition.attribute<User>('age').gt(18))
 *   .orderBy('lastName', 'asc')
 *   .limit(10)
 *   .execute();
 */
export class CouchDBStatement<
  M extends Model,
  A extends Adapter<any, any, MangoQuery, any>,
  R,
> extends Statement<M, A, R, MangoQuery> {
  constructor(adapter: A) {
    super(adapter);
  }

  /**
   * @description Builds a CouchDB Mango query from the statement
   * @summary Converts the statement's conditions, selectors, and options into a CouchDB Mango query
   * @return {MangoQuery} The built Mango query
   * @throws {Error} If there are invalid query conditions
   * @mermaid
   * sequenceDiagram
   *   participant Statement
   *   participant Repository
   *   participant parseCondition
   *
   *   Statement->>Statement: build()
   *   Note over Statement: Initialize selectors
   *   Statement->>Repository: Get table name
   *   Repository-->>Statement: Return table name
   *   Statement->>Statement: Create base query
   *
   *   alt Has selectSelector
   *     Statement->>Statement: Add fields to query
   *   end
   *
   *   alt Has whereCondition
   *     Statement->>Statement: Create combined condition with table
   *     Statement->>parseCondition: Parse condition
   *     parseCondition-->>Statement: Return parsed condition
   *
   *     alt Is group operator
   *       alt Is AND operator
   *         Statement->>Statement: Flatten nested AND conditions
   *       else Is OR operator
   *         Statement->>Statement: Combine with table condition
   *       else
   *         Statement->>Statement: Throw error
   *       end
   *     else
   *       Statement->>Statement: Merge conditions with existing selector
   *     end
   *   end
   *
   *   alt Has orderBySelector
   *     Statement->>Statement: Add sort to query
   *     Statement->>Statement: Ensure field exists in selector
   *   end
   *
   *   alt Has limitSelector
   *     Statement->>Statement: Set limit
   *   else
   *     Statement->>Statement: Use default limit
   *   end
   *
   *   alt Has offsetSelector
   *     Statement->>Statement: Set skip
   *   end
   *
   *   Statement-->>Statement: Return query
   */
  protected build(): MangoQuery {
    const log = this.log.for(this.build);
    const selectors: MangoSelector = {};
    selectors[CouchDBKeys.TABLE] = {};
    selectors[CouchDBKeys.TABLE] = Model.tableName(this.fromSelector);
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
            log.warn(
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
      log.warn(
        `No limit selector defined. Using default couchdb limit of ${CouchDBQueryLimit}`
      );
      query.limit = CouchDBQueryLimit;
    }

    if (this.offsetSelector) query.skip = this.offsetSelector;

    return query;
  }

  /**
   * @description Processes a record from CouchDB
   * @summary Extracts the ID from a CouchDB document and reverts it to a model instance
   * @param {any} r - The raw record from CouchDB
   * @param pkAttr - The primary key attribute of the model
   * @param {"Number" | "BigInt" | undefined} sequenceType - The type of the sequence
   * @return {any} The processed record
   */
  protected processRecord(
    r: any,
    pkAttr: keyof M,
    sequenceType: "Number" | "BigInt" | undefined,
    ctx: Context
  ) {
    if (r[CouchDBKeys.ID]) {
      const [, ...keyArgs] = r[CouchDBKeys.ID].split(CouchDBKeys.SEPARATOR);

      const id = keyArgs.join("_");
      return this.adapter.revert(
        r,
        this.fromSelector,
        Sequence.parseValue(sequenceType, id),
        undefined,
        ctx
      );
    }
    return r;
  }

  /**
   * @description Executes a raw Mango query
   * @summary Sends a raw Mango query to CouchDB and processes the results
   * @template R - The result type
   * @param {MangoQuery} rawInput - The raw Mango query to execute
   * @return {Promise<R>} A promise that resolves to the query results
   */
  override async raw<R>(rawInput: MangoQuery, ...args: any[]): Promise<R> {
    const { ctx } = this.logCtx(args, this.raw);

    const results: any[] = await this.adapter.raw(rawInput, true, ctx);

    const pkAttr = Model.pk(this.fromSelector);
    const type = Metadata.get(
      this.fromSelector,
      Metadata.key(DBKeys.ID, pkAttr as string)
    )?.type;

    if (!this.selectSelector)
      return results.map((r) => this.processRecord(r, pkAttr, type, ctx)) as R;
    return results as R;
  }

  /**
   * @description Parses a condition into a CouchDB Mango query selector
   * @summary Converts a Condition object into a CouchDB Mango query selector structure
   * @param {Condition<M>} condition - The condition to parse
   * @return {MangoQuery} The Mango query with the parsed condition as its selector
   * @mermaid
   * sequenceDiagram
   *   participant Statement
   *   participant translateOperators
   *   participant merge
   *
   *   Statement->>Statement: parseCondition(condition)
   *
   *   Note over Statement: Extract condition parts
   *
   *   alt Simple comparison operator
   *     Statement->>translateOperators: translateOperators(operator)
   *     translateOperators-->>Statement: Return CouchDB operator
   *     Statement->>Statement: Create selector with attribute and operator
   *   else NOT operator
   *     Statement->>Statement: parseCondition(attr1)
   *     Statement->>translateOperators: translateOperators(Operator.NOT)
   *     translateOperators-->>Statement: Return CouchDB NOT operator
   *     Statement->>Statement: Create negated selector
   *   else AND/OR operator
   *     Statement->>Statement: parseCondition(attr1)
   *     Statement->>Statement: parseCondition(comparison)
   *     Statement->>translateOperators: translateOperators(operator)
   *     translateOperators-->>Statement: Return CouchDB group operator
   *     Statement->>merge: merge(operator, op1, op2)
   *     merge-->>Statement: Return merged selector
   *   end
   *
   *   Statement-->>Statement: Return query with selector
   */
  protected parseCondition(condition: Condition<M>): MangoQuery {
    /**
     * @description Merges two selectors with a logical operator
     * @summary Helper function to combine two selectors with a logical operator
     * @param {MangoOperator} op - The operator to use for merging
     * @param {MangoSelector} obj1 - The first selector
     * @param {MangoSelector} obj2 - The second selector
     * @return {MangoQuery} The merged query
     */
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
