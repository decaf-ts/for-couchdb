import { Paginator, PagingError, Sequence } from "@decaf-ts/core";
import { findPrimaryKey, InternalError } from "@decaf-ts/db-decorators";
import { MangoQuery, MangoResponse } from "../types";
import { Constructor, Model } from "@decaf-ts/decorator-validation";
import { CouchDBAdapter } from "../adapter";
import { CouchDBKeys } from "../constants";

/**
 * @description Paginator for CouchDB query results
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
export class CouchDBPaginator<M extends Model, R> extends Paginator<
  M,
  R,
  MangoQuery
> {
  /**
   * @description Bookmark for CouchDB pagination
   * @summary Stores the bookmark returned by CouchDB for continuing pagination
   */
  private bookMark?: string;

  /**
   * @description Gets the total number of pages
   * @summary Not supported in CouchDB - throws an error when accessed
   * @return {number} Never returns as it throws an error
   * @throws {InternalError} Always throws as this functionality is not available in CouchDB
   */
  override get total(): number {
    throw new InternalError(`The total pages api is not available for couchdb`);
  }

  /**
   * @description Gets the total record count
   * @summary Not supported in CouchDB - throws an error when accessed
   * @return {number} Never returns as it throws an error
   * @throws {InternalError} Always throws as this functionality is not available in CouchDB
   */
  override get count(): number {
    throw new InternalError(
      `The record count api is not available for couchdb`
    );
  }

  /**
   * @description Creates a new CouchDBPaginator instance
   * @summary Initializes a paginator for CouchDB query results
   * @param {CouchDBAdapter<any, any, any>} adapter - The CouchDB adapter
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
  async page(page: number = 1): Promise<R[]> {
    const statement = Object.assign({}, this.statement);

   if (!this._recordCount || !this._totalPages) {
        this._totalPages = this._recordCount = 0;
        const results: R[] = await this.adapter.raw({ ...statement, limit: undefined }) || [];
        this._recordCount = results.length;
        if (this._recordCount > 0) {
            const size = statement?.limit || this.size;
            this._totalPages = Math.ceil(this._recordCount / size);
        }
    }

    this.validatePage(page);

    if (page !== 1) {
      if (!this.bookMark)
        throw new PagingError("No bookmark. Did you start in the first page?");
      statement["bookmark"] = this.bookMark;
    }
    const rawResult: MangoResponse<any> = await this.adapter.raw(
      statement,
      false
    );

    const { docs, bookmark, warning } = rawResult;
    if (warning) console.warn(warning);
    if (!this.clazz) throw new PagingError("No statement target defined");
    const pkDef = findPrimaryKey(new this.clazz());
    const results =
      statement.fields && statement.fields.length
        ? docs // has fields means its not full model
        : docs.map((d: any) => {
            //no fields means we need to revert to saving process
            const originalId = d._id.split(CouchDBKeys.SEPARATOR);
            originalId.splice(0, 1); // remove the table name
            return this.adapter.revert(
              d,
              this.clazz,
              pkDef.id,
              Sequence.parseValue(
                pkDef.props.type,
                originalId.join(CouchDBKeys.SEPARATOR)
              )
            );
          });
    this.bookMark = bookmark;
    this._currentPage = page;
    return results;
  }
}
