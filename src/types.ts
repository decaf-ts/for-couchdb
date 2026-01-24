/**
 * @description Response from a CouchDB Mango query
 * @summary Contains the matching documents and additional metadata about the query execution
 * @interface MangoResponse
 * @template D - The document type
 * @memberOf module:for-couchdb
 * @see Docs: {@link https://docs.couchdb.org/en/latest/api/database/find.html#db-find}
 */
export interface MangoResponse<D> {
  /** Array of documents matching the search.
   *
   * In each matching document, the fields specified in the fields part of the request body are listed, along with
   * their values. */
  docs: (D & { _id: string; _rev: string })[];

  /** A string that enables you to specify which page of results you require.
   *
   * Used for paging through result sets. */
  bookmark?: string;

  /** Execution warnings */
  warning?: string;

  /** Basic execution statistics for a specific request. */
  execution_stats?: MangoExecutionStats;
}

/**
 * @description Statistics about the execution of a Mango query
 * @summary Provides detailed metrics about query execution including document and key examination counts
 * @interface MangoExecutionStats
 * @memberOf module:for-couchdb
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#execution-statistics}
 */
export interface MangoExecutionStats {
  /** Number of index keys examined. Currently always 0. */
  total_keys_examined: number;

  /** Number of documents fetched from the database / index.
   *
   * Equivalent to using include_docs = true in a view. */
  total_docs_examined: number;

  /** Number of documents fetched from the database using an out-of-band document fetch.
   *
   * This is only non-zero when read quorum > 1 is specified in the query parameters. */
  total_quorum_docs_examined: number;

  /** Number of results returned from the query. */
  results_returned: number;

  /** Total execution time in milliseconds as measured by the database. */
  execution_time_ms: number;
}

/**
 * @description Parameters for creating a CouchDB Mango index
 * @summary Defines the structure and configuration for a new Mango index
 * @interface CreateIndexRequest
 * @memberOf module:for-couchdb
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#db-index}
 */
export interface CreateIndexRequest {
  /** JSON object describing the index to create */
  index: {
    /** Array of field names following the sort syntax. */
    fields: SortOrder[];

    /** A selector to apply to documents at indexing time, creating a partial index. */
    partial_filter_selector?: MangoSelector;
  };

  /** Name of the design document in which the index will be created. */
  ddoc?: string;

  /** Name of the index. If no name is provided, a name will be generated automatically. */
  name?: string;

  /** Can be "json" or "text".
   *
   * @default "json" */
  type?: "json" | "text";

  /** This field sets whether the created index will be a partitioned or global index. */
  partitioned?: boolean;
}

/**
 * @description Represents the possible value types in a Mango query
 * @summary Union type of all possible value types that can be used in Mango queries
 * @typedef {(number|string|Date|boolean|object|null)} MangoValue
 * @memberOf module:for-couchdb
 */
export type MangoValue = number | string | Date | boolean | object | null;

/**
 * @description Operators available in Mango queries
 * @summary Union type of all possible operators that can be used in Mango queries
 * @typedef {string} MangoOperator
 * @memberOf module:for-couchdb
 */
export type MangoOperator =
  | "$lt"
  | "$lte"
  | "$eq"
  | "$ne"
  | "$gte"
  | "$gt"
  | "$exists"
  | "$type"
  | "$in"
  | "$nin"
  | "$size"
  | "$mod"
  | "$regex"
  | "$or"
  | "$and"
  | "$nor"
  | "$not"
  | "$all"
  | "$allMatch"
  | "$elemMatch";
/**
 * @description Represents a CouchDB Mango query selector
 * @summary Type for defining query conditions in Mango queries
 * @typedef {Object} MangoSelector
 * @memberOf module:for-couchdb
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#selector-syntax}
 */
export type MangoSelector = {
  [K in MangoOperator | string]:
    | MangoSelector
    | MangoSelector[]
    | MangoValue
    | MangoValue[];
};

/**
 * @description Represents a sort order specification in Mango queries
 * @summary Type for defining sort order in Mango queries
 * @typedef {(string|string[]|Object)} SortOrder
 * @memberOf module:for-couchdb
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#sort-syntax}
 */
export type SortOrder = string | string[] | { [key: string]: "asc" | "desc" };

/**
 * @description Represents a CouchDB Mango query
 * @summary Interface for defining complete Mango queries with selectors, sorting, pagination, and other options
 * @interface MangoQuery
 * @memberOf module:for-couchdb
 * @see Docs: {@link https://docs.couchdb.org/en/latest/api/database/find.html#db-find}
 */
export interface MangoQuery {
  /** JSON object describing criteria used to select documents. */
  selector: MangoSelector;

  /** Maximum number of results returned. @default 25 */
  limit?: number;

  /** Skip the first 'n' results, where 'n' is the value specified. */
  skip?: number;

  /** JSON array following sort syntax. */
  sort?: SortOrder[];

  /** JSON array specifying which fields of each object should be returned.
   *
   * If it is omitted, the entire object is returned.
   *
   * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#filtering-fields} */
  fields?: string[];

  /* Instruct a query to use a specific index.
   *
   * Specified either as "<design_document>" or ["<design_document>", "<index_name>"]. */
  use_index?: string | [string, string];

  /** Read quorum needed for the result.
   *
   * @default 1 */
  r?: number;

  /** A string that enables you to specify which page of results you require.
   *
   * Used for paging through result sets. */
  bookmark?: string;

  /** Whether to update the index prior to returning the result.
   *
   * @default true */
  update?: boolean;

  /** Whether or not the view results should be returned from a “stable” set of shards. */
  stable?: boolean;

  /** Combination of update = false and stable = true options.
   *
   * Possible options: "ok", false (default). */
  stale?: "ok" | false;

  /** Include execution statistics in the query response.
   *
   * Optional, default: false. */
  execution_stats?: boolean;
}

export interface ViewRow<D = any> {
  id?: string;
  key?: any;
  value?: any;
  doc?: D;
}

export interface ViewResponse<D = any> {
  total_rows?: number;
  offset?: number;
  rows: ViewRow<D>[];
}
