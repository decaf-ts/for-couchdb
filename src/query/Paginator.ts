import {
  ContextualArgs,
  MaybeContextualArg,
  Paginator,
  PagingError,
  Sequence,
} from "@decaf-ts/core";
import { DBKeys } from "@decaf-ts/db-decorators";
import { MangoQuery, MangoResponse, ViewResponse } from "../types";
import { Model } from "@decaf-ts/decorator-validation";
import { CouchDBAdapter } from "../adapter";
import { Constructor, Metadata } from "@decaf-ts/decoration";
import { CouchDBKeys } from "../constants";
import { buildQueryIndexName } from "../indexes/generator";
import { extractEqualityFilters } from "./selector-utils";

/**
 * @description Paginator for ConuchDB query results
 * @summary Implements pagination for CouchDB queries using bookmarks for efficient navigation through result sets
 * @template M - The model type that extends Model
 * @template R - The result type
 * @param {CouchDBAdapter<any, any, any>} adapter - The CouchDB adapter
 * @param {MangoQuery} query - The Mango query to paginate
 * @param {number} size - The page size
 * @param {Constructor<M>} clazz - The model constructor
 * @class CouchDBPaginator
 * @example
 * // Example of using CouchDBPaginator
 * const adapter = new MyCouchDBAdapter(scope);
 * const query = { selector: { type: "user" } };
 * const paginator = new CouchDBPaginator(adapter, query, 10, User);
 *
 * // Get the first page
 * const page1 = await paginator.page(1);
 *
 * // Get the next page
 * const page2 = await paginator.page(2);
 */
export class CouchDBPaginator<M extends Model> extends Paginator<
  M,
  M[],
  MangoQuery
> {
  private readonly defaultQueryAttributes: Set<string>;

  /**
   * @description Creates a new CouchDBPaginator instance
   * @summary Initializes a paginator for CouchDB query results
   * @param {CouchDBAdapter<any, any, any, any>} adapter - The CouchDB adapter
   * @param {MangoQuery} query - The Mango query to paginate
   * @param {number} size - The page size
   * @param {Constructor<M>} clazz - The model constructor
   */
  constructor(
    adapter: CouchDBAdapter<any, any, any>,
    query: MangoQuery,
    size: number,
    clazz: Constructor<M>
  ) {
    super(adapter, query, size, clazz);
    try {
      this.defaultQueryAttributes = new Set(
        Model.defaultQueryAttributes(clazz, false) || []
      );
    } catch {
      this.defaultQueryAttributes = new Set();
    }
  }

  /**
   * @description Prepares a query for pagination
   * @summary Modifies the raw query to include pagination parameters
   * @param {MangoQuery} rawStatement - The original Mango query
   * @return {MangoQuery} The prepared query with pagination parameters
   */
  protected prepare(rawStatement: MangoQuery): MangoQuery {
    const query: MangoQuery = Object.assign({}, rawStatement);
    if (query.limit) this.limit = query.limit;

    query.limit = this.size;

    return query;
  }

  /**
   * @description Retrieves a specific page of results
   * @summary Executes the query with pagination and processes the results
   * @param {number} [page=1] - The page number to retrieve
   * @return {Promise<R[]>} A promise that resolves to an array of results
   * @throws {PagingError} If trying to access a page other than the first without a bookmark, or if no class is defined
   * @mermaid
   * sequenceDiagram
   *   participant Client
   *   participant CouchDBPaginator
   *   participant Adapter
   *   participant CouchDB
   *
   *   Client->>CouchDBPaginator: page(pageNumber)
   *   Note over CouchDBPaginator: Clone statement
   *   CouchDBPaginator->>CouchDBPaginator: validatePage(page)
   *
   *   alt page !== 1
   *     CouchDBPaginator->>CouchDBPaginator: Check bookmark
   *     alt No bookmark
   *       CouchDBPaginator-->>Client: Throw PagingError
   *     else Has bookmark
   *       CouchDBPaginator->>CouchDBPaginator: Add bookmark to statement
   *     end
   *   end
   *
   *   CouchDBPaginator->>Adapter: raw(statement, false)
   *   Adapter->>CouchDB: Execute query
   *   CouchDB-->>Adapter: Return results
   *   Adapter-->>CouchDBPaginator: Return MangoResponse
   *
   *   Note over CouchDBPaginator: Process results
   *
   *   alt Has warning
   *     CouchDBPaginator->>CouchDBPaginator: Log warning
   *   end
   *
   *   CouchDBPaginator->>CouchDBPaginator: Check for clazz
   *
   *   alt No clazz
   *     CouchDBPaginator-->>Client: Throw PagingError
   *   else Has clazz
   *     CouchDBPaginator->>CouchDBPaginator: Find primary key
   *
   *     alt Has fields in statement
   *       CouchDBPaginator->>CouchDBPaginator: Use docs directly
   *     else No fields
   *       CouchDBPaginator->>CouchDBPaginator: Process each document
   *       loop For each document
   *         CouchDBPaginator->>CouchDBPaginator: Extract original ID
   *         CouchDBPaginator->>Adapter: revert(doc, clazz, pkDef.id, parsedId)
   *       end
   *     end
   *
   *     CouchDBPaginator->>CouchDBPaginator: Store bookmark
   *     CouchDBPaginator->>CouchDBPaginator: Update currentPage
   *     CouchDBPaginator-->>Client: Return results
   *   end
   */
  override async page(
    page: number | undefined = 1,
    bookmark?: any,
    ...args: MaybeContextualArg<any>
  ): Promise<M[]> {
    const { log, ctxArgs, ctx } = this.adapter["logCtx"](
      [bookmark, ...args],
      this.page
    );
    if (this.isPreparedStatement())
      return await this.pagePrepared(page, ...ctxArgs);
    const statement = Object.assign({}, this.statement);
    const couchAdapter = this.adapter as CouchDBAdapter<any, any, any>;
    const nativePlan =
      couchAdapter.nativeIndexPlan?.(statement, ctx) ?? undefined;
    const nativeMode = !!nativePlan;

    if (!this._recordCount && this._recordCount !== 0) {
      await this.computeCounts(statement, ctxArgs);
    }

    if (!this._recordCount) {
      this._totalPages = 0;
      this._currentPage = 0;
      this._bookmark = undefined;
      return [];
    }

    page = this.validatePage(page);
    statement.skip = (page - 1) * this.size;

    if (!nativeMode && page !== 1) {
      if (!this._bookmark)
        throw new PagingError("No bookmark. Did you start in the first page?");
      statement["bookmark"] = this._bookmark as string;
    }

    const rawResult: MangoResponse<any> = (await this.adapter.raw(
      statement,
      false,
      ...ctxArgs
    )) as any;

    const { docs, bookmark: nextBookmark, warning } = rawResult;
    if (warning) log.warn(warning);
    if (!this.clazz) throw new PagingError("No statement target defined");
    const id = Model.pk(this.clazz);
    const type = Metadata.get(
      this.clazz,
      Metadata.key(DBKeys.ID, id as string)
    )?.type;
    const pageResults =
      statement.fields && statement.fields.length
        ? docs // has fields means its not full model
        : docs.map((d: any) => {
            return this.adapter.revert(
              d,
              this.clazz,
              Sequence.parseValue(type, d[id]),
              undefined,
              ctx
            );
          });
    this._bookmark = nativeMode ? undefined : nextBookmark;
    this._currentPage = page;
    return pageResults;
  }

  private async computeCounts(
    statement: MangoQuery,
    ctxArgs: ContextualArgs<any>
  ): Promise<void> {
    const plan = this.buildCountPlan(statement);
    let total = await this.countViaView(plan, ctxArgs);
    if (typeof total === "undefined") {
      total = await this.countViaQuery(statement, ctxArgs);
    }
    this._recordCount = total;
    const size = statement?.limit || this.size;
    this._totalPages = total ? Math.ceil(total / size) : 0;
  }

  private async countViaView(
    plan: CountViewPlan | undefined,
    ctxArgs: ContextualArgs<any>
  ): Promise<number | undefined> {
    if (!plan) return undefined;
    try {
      const couchAdapter = this.adapter as CouchDBAdapter<any, any, any>;
      const options: Record<string, any> = {
        reduce: true,
        group: true,
        key: plan.key,
      };
      const response = await couchAdapter.view<ViewResponse>(
        plan.ddoc,
        plan.view,
        options,
        ...ctxArgs
      );
      if (!response || !response.rows || !response.rows.length) return 0;
      const row = response.rows[0];
      return typeof row.value === "number" ? row.value : 0;
    } catch {
      return undefined;
    }
  }

  private async countViaQuery(
    statement: MangoQuery,
    ctxArgs: ContextualArgs<any>
  ): Promise<number> {
    const countQuery: MangoQuery = Object.assign({}, statement, {
      limit: Number.MAX_SAFE_INTEGER,
    });
    delete (countQuery as any).bookmark;
    delete countQuery.skip;

    const countResults =
      (await this.adapter.raw<M[], true>(countQuery, true, ...ctxArgs)) || [];
    return countResults.length;
  }

  private buildCountPlan(statement: MangoQuery): CountViewPlan | undefined {
    const filters = extractEqualityFilters(statement.selector);
    if (!filters) return undefined;
    const tableName = filters[CouchDBKeys.TABLE];
    if (!tableName) return undefined;
    const filterKeys = Object.keys(filters).filter(
      (key) => key !== CouchDBKeys.TABLE
    );
    if (!filterKeys.length) {
      const indexName = buildQueryIndexName([CouchDBKeys.TABLE]);
      return { ddoc: indexName, view: indexName, key: [tableName] };
    }
    if (filterKeys.length !== 1) return undefined;
    const attr = filterKeys[0];
    if (!this.defaultQueryAttributes.has(attr)) return undefined;
    const attrValue = filters[attr];
    const indexName = buildQueryIndexName([
      Model.tableName(this.clazz),
      attr,
      "defaultQuery",
    ]);
    return { ddoc: indexName, view: indexName, key: [tableName, attrValue] };
  }
}

type CountViewPlan = {
  ddoc: string;
  view: string;
  key: any[];
};
