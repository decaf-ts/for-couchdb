import {
  Adapter,
  Condition,
  ContextOf,
  GroupOperator,
  Operator,
  OrderDirection,
  QueryError,
  Sequence,
  SelectSelector,
  Statement,
  UnsupportedError,
  ViewKind,
} from "@decaf-ts/core";
import {
  MangoOperator,
  MangoQuery,
  MangoSelector,
  ViewResponse,
} from "../types";
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
import {
  generateDesignDocName,
  generateViewName,
  findViewMetadata,
} from "../views/generator";
import { CouchDBViewMetadata } from "../views/types";
import { CouchDBAdapter } from "../adapter";

type CouchDBViewDescriptor = {
  ddoc: string;
  view: string;
  options: Record<string, any>;
};

type CouchDBAggregateInfo =
  | {
      kind: ViewKind;
      meta: CouchDBViewMetadata;
      descriptor: CouchDBViewDescriptor;
      countDistinct?: boolean;
    }
  | {
      kind: "avg";
      attribute: string;
      sumDescriptor: CouchDBViewDescriptor;
      countDescriptor: CouchDBViewDescriptor;
    };

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
  private manualAggregation?: CouchDBAggregateInfo;
  private attributeTypeCache: Map<string, string | undefined> = new Map();

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
    this.manualAggregation = undefined;
    const aggregateInfo = this.buildAggregateInfo();
    if (aggregateInfo) {
      if (this.shouldUseManualAggregation()) {
        this.manualAggregation = aggregateInfo;
      } else {
        return this.createAggregateQuery(aggregateInfo);
      }
    }
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

    if (this.orderBySelectors?.length) {
      query.sort = query.sort || [];
      query.selector = query.selector || ({} as MangoSelector);
      for (const [selectorKey, direction] of this.orderBySelectors) {
        const selector = selectorKey as string;
        const rec: Record<string, OrderDirection> = {};
        rec[selector] = direction as OrderDirection;
        (query.sort as Record<string, OrderDirection>[]).push(rec);
        if (!query.selector[selector]) {
          query.selector[selector] = {} as MangoSelector;
          (query.selector[selector] as MangoSelector)[CouchDBOperator.BIGGER] =
            null;
        }
      }
    }

    const hasManualAggregate = !!this.manualAggregation;
    if (this.limitSelector) {
      query.limit = this.limitSelector;
    } else if (!hasManualAggregate) {
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
    const aggregator = (rawInput as any)?.aggregateInfo;
    if ((rawInput as any)?.aggregate && aggregator) {
      return this.executeAggregate<R>(aggregator, ctx);
    }
    const results: any[] = await this.adapter.raw(rawInput, true, ctx);

    const pkAttr = Model.pk(this.fromSelector);
    const type = Metadata.get(
      this.fromSelector,
      Metadata.key(DBKeys.ID, pkAttr as string)
    )?.type;
    const processed = results.map((r) =>
      this.processRecord(r, pkAttr, type, ctx)
    );
    if (this.manualAggregation) {
      const manualResult = this.executeManualAggregation<R>(
        processed,
        this.manualAggregation,
        ctx
      );
      this.manualAggregation = undefined;
      return manualResult;
    }

    if (!this.selectSelector && this.groupBySelectors?.length) {
      return this.groupSelectResults(processed) as R;
    }

    if (!this.selectSelector) return processed as R;
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
  private buildAggregateInfo(): CouchDBAggregateInfo | undefined {
    if (!this.fromSelector) return undefined;

    if (this.avgSelector) {
      const attribute = String(this.avgSelector);
      const sumInfo = this.createAggregateDescriptor("sum", attribute);
      if (!sumInfo) throw this.missingDecorator("sum", attribute);
      const countInfo = this.createAggregateDescriptor("count", attribute);
      if (!countInfo) throw this.missingDecorator("count", attribute);
      return {
        kind: "avg",
        attribute,
        sumDescriptor: sumInfo.descriptor,
        countDescriptor: countInfo.descriptor,
      };
    }

    if (typeof this.countDistinctSelector !== "undefined") {
      const attribute = this.resolveSelectorAttribute(
        this.countDistinctSelector
      );
      const info = this.createAggregateDescriptor("distinct", attribute);
      if (!info) throw this.missingDecorator("distinct", attribute);
      info.countDistinct = true;
      return info;
    }

    if (typeof this.countSelector !== "undefined") {
      const attribute = this.resolveSelectorAttribute(this.countSelector);
      const info = this.createAggregateDescriptor("count", attribute);
      if (!info) throw this.missingDecorator("count", attribute);
      return info;
    }

    if (this.maxSelector) {
      const attribute = this.resolveSelectorAttribute(this.maxSelector);
      const info = this.createAggregateDescriptor("max", attribute);
      if (!info) throw this.missingDecorator("max", attribute);
      return info;
    }

    if (this.minSelector) {
      const attribute = this.resolveSelectorAttribute(this.minSelector);
      const info = this.createAggregateDescriptor("min", attribute);
      if (!info) throw this.missingDecorator("min", attribute);
      return info;
    }

    if (this.sumSelector) {
      const attribute = this.resolveSelectorAttribute(this.sumSelector);
      const info = this.createAggregateDescriptor("sum", attribute);
      if (!info) throw this.missingDecorator("sum", attribute);
      return info;
    }

    if (this.distinctSelector) {
      const attribute = this.resolveSelectorAttribute(this.distinctSelector);
      const info = this.createAggregateDescriptor("distinct", attribute);
      if (!info) throw this.missingDecorator("distinct", attribute);
      return info;
    }

    return undefined;
  }

  private createAggregateDescriptor(
    kind: ViewKind,
    attribute?: string
  ): Extract<CouchDBAggregateInfo, { kind: ViewKind }> | undefined {
    if (!this.fromSelector) return undefined;
    const metas = findViewMetadata(this.fromSelector, kind, attribute);
    if (!metas.length) return undefined;
    const meta = metas[0];
    const tableName = Model.tableName(this.fromSelector);
    const viewName = generateViewName(tableName, meta.attribute, kind, meta);
    const ddoc = meta.ddoc || generateDesignDocName(tableName, viewName);
    const options: Record<string, any> = {
      reduce: meta.reduce !== undefined ? true : !meta.returnDocs,
    };
    if (kind === "distinct" || kind === "groupBy") options.group = true;
    return {
      kind,
      meta,
      descriptor: {
        ddoc,
        view: viewName,
        options,
      },
    };
  }

  private createAggregateQuery(
    info: CouchDBAggregateInfo
  ): MangoQuery & { aggregate: true; aggregateInfo: CouchDBAggregateInfo } {
    return {
      selector: {},
      aggregate: true,
      aggregateInfo: info,
    } as MangoQuery & { aggregate: true; aggregateInfo: CouchDBAggregateInfo };
  }

  private shouldUseManualAggregation(): boolean {
    return !!this.whereCondition;
  }

  private async executeAggregate<R>(
    info: CouchDBAggregateInfo,
    ctx: ContextOf<A>
  ): Promise<R> {
    if (!this.isViewAggregate(info)) {
      return this.handleAverage<R>(info, ctx);
    }
    const couchAdapter = this.getCouchAdapter();
    const viewInfo = info as Extract<CouchDBAggregateInfo, { kind: ViewKind }>;
    const response = await couchAdapter.view<ViewResponse>(
      viewInfo.descriptor.ddoc,
      viewInfo.descriptor.view,
      viewInfo.descriptor.options,
      ctx
    );
    return this.processViewResponse<R>(info, response);
  }

  private async handleAverage<R>(
    info: CouchDBAggregateInfo,
    ctx: ContextOf<A>
  ): Promise<R> {
    if (info.kind !== "avg")
      throw new QueryError("Average descriptor is not valid");
    const [sumDesc, countDesc] = [info.sumDescriptor, info.countDescriptor];
    const couchAdapter = this.getCouchAdapter();
    const [sumResponse, countResponse] = await Promise.all([
      couchAdapter.view<ViewResponse>(
        sumDesc.ddoc,
        sumDesc.view,
        sumDesc.options,
        ctx
      ),
      couchAdapter.view<ViewResponse>(
        countDesc.ddoc,
        countDesc.view,
        countDesc.options,
        ctx
      ),
    ]);
    const sum = sumResponse.rows?.[0]?.value ?? 0;
    const count = countResponse.rows?.[0]?.value ?? 0;
    if (!count) return 0 as unknown as R;
    return (sum / count) as unknown as R;
  }

  private executeManualAggregation<R>(
    docs: any[],
    info: CouchDBAggregateInfo,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ctx: ContextOf<A>
  ): R {
    if (!this.fromSelector)
      throw new QueryError("Manual aggregation requires a target model");
    if (info.kind === "avg") {
      return this.computeAverage<R>(docs, info.attribute) as R;
    }

    if (info.kind === "groupBy") {
      return this.computeGroupBy<R>(docs, info.meta.attribute) as R;
    }

    const attribute = info.meta.attribute;
    switch (info.kind) {
      case "count": {
        if (info.countDistinct) {
          return this.computeDistinctCount<R>(docs, attribute) as R;
        }
        return this.computeCount<R>(docs, attribute) as R;
      }
      case "distinct":
        if (info.countDistinct) {
          return this.computeDistinctCount<R>(docs, attribute) as R;
        }
        return this.computeDistinctValues<R>(docs, attribute) as R;
      case "sum":
        return this.computeSum<R>(docs, attribute) as R;
      case "min":
        return this.computeMinMax<R>(docs, attribute, "min") as R;
      case "max":
        return this.computeMinMax<R>(docs, attribute, "max") as R;
      default:
        throw new QueryError(`Unsupported manual aggregation ${info.kind}`);
    }
  }

  private computeCount<R>(docs: any[], attribute?: string): R {
    if (!attribute) return docs.length as unknown as R;
    const values = this.collectValues(docs, attribute);
    return values.filter((value) => value !== undefined && value !== null)
      .length as R;
  }

  private computeDistinctCount<R>(docs: any[], attribute?: string): R {
    const values = attribute
      ? this.collectValues(docs, attribute).filter(
          (value) => value !== undefined && value !== null
        )
      : docs;
    const seen = new Set<string>();
    values.forEach((value) => seen.add(JSON.stringify(value)));
    return seen.size as unknown as R;
  }

  private computeDistinctValues<R>(docs: any[], attribute?: string): R {
    if (!attribute) return [] as unknown as R;
    const values = this.collectValues(docs, attribute);
    const seen = new Set<string>();
    const unique: any[] = [];
    values.forEach((value) => {
      const key = JSON.stringify(value);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(value);
      }
    });
    return unique as unknown as R;
  }

  private computeSum<R>(docs: any[], attribute?: string): R {
    if (!attribute) return docs.length as unknown as R;
    const values = this.collectValues(docs, attribute).filter(
      (value) => value !== undefined && value !== null
    );
    const sum = values.reduce(
      (acc, value) =>
        acc + this.toNumericValue(value, attribute, "SUM operation"),
      0
    );
    return sum as unknown as R;
  }

  private computeAverage<R>(docs: any[], attribute?: string): R {
    if (!attribute) return 0 as unknown as R;
    const values = this.collectValues(docs, attribute).filter(
      (value) => value !== undefined && value !== null
    );
    if (!values.length) return 0 as unknown as R;
    const sum = values.reduce(
      (acc, value) =>
        acc + this.toNumericValue(value, attribute, "AVG operation"),
      0
    );
    return (sum / values.length) as unknown as R;
  }

  private computeMinMax<R>(
    docs: any[],
    attribute: string | undefined,
    mode: "min" | "max"
  ): R {
    if (!attribute) return null as unknown as R;
    const values = this.collectValues(docs, attribute).filter(
      (value) => value !== undefined && value !== null
    );
    let currentValue: any = null;
    let currentComparable: number | null = null;
    for (const value of values) {
      const normalized = this.normalizeComparable(value);
      if (normalized === null) continue;
      if (currentComparable === null) {
        currentComparable = normalized;
        currentValue = value;
        continue;
      }
      if (
        (mode === "min" && normalized < currentComparable) ||
        (mode === "max" && normalized > currentComparable)
      ) {
        currentComparable = normalized;
        currentValue = value;
      }
    }
    return currentValue as unknown as R;
  }

  private computeGroupBy<R>(docs: any[], attribute: string): R {
    const grouped: Record<string, any[]> = {};
    const values = this.collectValues(docs, attribute);
    docs.forEach((doc, index) => {
      const key = this.groupKey(values[index]);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(doc);
    });
    return grouped as unknown as R;
  }

  private groupSelectResults(docs: any[]): Record<string, any[]> {
    if (!this.groupBySelectors?.length) return {};
    const attribute = this.resolveSelectorAttribute(this.groupBySelectors[0]);
    if (!attribute) return {};
    const grouped: Record<string, any[]> = {};
    docs.forEach((doc) => {
      const key = this.groupKey(
        this.convertValueByAttribute(attribute, doc[attribute])
      );
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(doc);
    });
    return grouped;
  }

  private collectValues(docs: any[], attribute: string): any[] {
    return docs.map((doc) => {
      if (!doc || typeof doc !== "object") return undefined;
      return this.convertValueByAttribute(attribute, doc[attribute]);
    });
  }

  private convertValueByAttribute(attribute: string, value: any): any {
    if (!this.fromSelector) return value;
    const attributeType = this.getAttributeType(attribute);
    if (attributeType === "date") {
      if (value instanceof Date) return value;
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (typeof value === "string" && attribute.toLowerCase().includes("date")) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return value;
  }

  private getAttributeType(attribute?: string): string | undefined {
    if (!attribute || !this.fromSelector) return undefined;
    if (this.attributeTypeCache.has(attribute)) {
      return this.attributeTypeCache.get(attribute);
    }
    const metaType =
      Metadata.type(this.fromSelector, attribute as any) ??
      (Metadata as any).getPropDesignTypes?.(this.fromSelector, attribute)
        ?.designType;
    const normalized = this.normalizeMetaType(metaType);
    this.attributeTypeCache.set(attribute, normalized);
    return normalized;
  }

  private normalizeMetaType(metaType: any): string | undefined {
    if (!metaType) return undefined;
    if (typeof metaType === "string") return metaType.toLowerCase();
    if (typeof metaType === "function" && metaType.name)
      return metaType.name.toLowerCase();
    return undefined;
  }

  private normalizeComparable(value: any): number | null {
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string" && !isNaN(Number(value)))
      return Number(value);
    return null;
  }

  private groupKey(value: any): string {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "symbol") return value.toString();
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  private toNumericValue(value: any, field: string, context: string): number {
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string" && !isNaN(Number(value)))
      return Number(value);
    throw new QueryError(
      `${context} on "${field}" requires numeric values, but got ${typeof value}`
    );
  }

  private convertAggregateValue(
    attribute: string | undefined,
    value: any
  ): any {
    if (!attribute) return value;
    return this.convertValueByAttribute(attribute, value);
  }

  private resolveSelectorAttribute(
    selector?: SelectSelector<M> | null
  ): string | undefined {
    if (selector == null) return undefined;
    return String(selector);
  }

  private missingDecorator(
    kind: ViewKind | "avg",
    attribute?: string
  ): UnsupportedError {
    const decorator = this.decoratorForKind(kind);
    const table = this.fromSelector
      ? Model.tableName(this.fromSelector)
      : "<unknown table>";
    const attributeDesc = attribute ? ` on "${attribute}"` : "";
    return new UnsupportedError(
      `${decorator} decorator is required for CouchDB ${kind} aggregation${attributeDesc} on table "${table}".`
    );
  }

  private decoratorForKind(kind: ViewKind | "avg"): string {
    const map: Record<string, string> = {
      count: "@count",
      sum: "@sum",
      min: "@min",
      max: "@max",
      distinct: "@distinct",
      groupBy: "@groupBy",
      view: "@view",
      avg: "@avg",
    };
    return map[kind] || `@${kind}`;
  }

  private processViewResponse<R>(
    info: CouchDBAggregateInfo,
    response: ViewResponse
  ): R {
    if (info.kind === "avg")
      throw new QueryError(
        "Average results should be handled before processing rows"
      );
    const rows = response.rows || [];
    const viewInfo = info as Extract<CouchDBAggregateInfo, { kind: ViewKind }>;
    const meta = viewInfo.meta;
    if (viewInfo.countDistinct) {
      return (rows.length || 0) as unknown as R;
    }
    if (viewInfo.kind === "distinct" || viewInfo.kind === "groupBy") {
      return rows.map((row) =>
        this.convertAggregateValue(
          viewInfo.meta.attribute,
          row.key ?? row.value
        )
      ) as unknown as R;
    }
    if (meta.returnDocs) {
      return rows.map((row) => row.value ?? row.doc ?? row) as unknown as R;
    }
    if (!rows.length) {
      return (viewInfo.kind === "count" ? 0 : null) as unknown as R;
    }
    return this.convertAggregateValue(
      viewInfo.meta.attribute,
      rows[0].value ?? rows[0].key ?? null
    ) as unknown as R;
  }

  private isViewAggregate(
    info: CouchDBAggregateInfo
  ): info is Extract<CouchDBAggregateInfo, { kind: ViewKind }> {
    return info.kind !== "avg";
  }

  private getCouchAdapter(): CouchDBAdapter<any, any, any> {
    return this.adapter as unknown as CouchDBAdapter<any, any, any>;
  }

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

    if (operator === Operator.BETWEEN) {
      const attr = attr1 as string;
      if (!Array.isArray(comparison) || comparison.length !== 2)
        throw new QueryError("BETWEEN operator requires [min, max] comparison");
      const [min, max] = comparison;
      const opBetween: MangoSelector = {} as MangoSelector;
      opBetween[attr] = {} as MangoSelector;
      (opBetween[attr] as MangoSelector)[
        translateOperators(Operator.BIGGER_EQ)
      ] = min;
      (opBetween[attr] as MangoSelector)[
        translateOperators(Operator.SMALLER_EQ)
      ] = max;
      return { selector: opBetween };
    }

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
