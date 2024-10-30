/** Mango response.
 * @see Docs: {@link https://docs.couchdb.org/en/latest/api/database/find.html#db-find}  */
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

/** Mango execution stats.
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#execution-statistics} */
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

/** Document insert response:
 * @see POST docs: {@link http://docs.couchdb.org/en/latest/api/database/common.html#post--db}
 * @see PUT docs: {@link http://docs.couchdb.org/en/latest/api/document/common.html#put--db-docid} */
export interface DocumentInsertResponse {
  /** Document ID */
  id: string;

  /** Operation status */
  ok: boolean;

  /** Revision MVCC token */
  rev: string;
}

/** Mango create index response.
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#db-index} */
export interface CreateIndexResponse {
  /** Flag to show whether the index was created or one already exists.
   *
   * Can be “created” or “exists”. */
  result: string;

  /** Id of the design document the index was created in. */
  id: string;

  /** Name of the index created. */
  name: string;
}

/** Document delete response.
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/document/common.html#delete--db-docid} */
export interface DocumentDestroyResponse {
  /** Document ID */
  id: string;

  /** Operation status */
  ok: boolean;

  /** Revision MVCC token */
  rev: string;
}
/** Document get response:
 * @see docs: {@link http://docs.couchdb.org/en/latest/api/document/common.html#get--db-docid} */
export interface DocumentGetResponse {
  /** Document ID. */
  _id: string;

  /** Revision MVCC token. */
  _rev: string;

  /** Deletion flag. Available if document was removed. */
  _deleted?: boolean;

  /** Attachment’s stubs. Available if document has any attachments. */
  _attachments?: any;

  /** List of conflicted revisions. Available if requested with conflicts=true query parameter. */
  _conflicts?: any[];

  /** List of deleted conflicted revisions. Available if requested with deleted_conflicts=true query parameter. */
  _deleted_conflicts?: any[];

  /** Document’s update sequence in current database. Available if requested with local_seq=true query parameter. */
  _local_seq?: string;

  /** List of objects with information about local revisions and their status.
   *
   * Available if requested with open_revs query parameter. */
  _revs_info?: any[];

  /** List of local revision tokens without.
   *
   * Available if requested with revs=true query parameter. */
  _revisions?: any;
}

export interface BulkModifyDocsWrapper {
  docs: any[];
}

export interface BulkFetchDocsWrapper {
  keys: string[];
}
/** Bulk API response.
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/bulk-api.html#post--db-_bulk_docs} */
export interface DocumentBulkResponse {
  /** Document ID. Available in all cases */
  id: string;

  /** New document revision token. Available if document has saved without errors. */
  rev?: string;

  /** Error type. Available if response code is 4xx */
  error?: string;

  /** Error reason. Available if response code is 4xx */
  reason?: string;
}
/** Mango create index parameters.
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#db-index} */
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

export type MangoValue = number | string | Date | boolean | object | null;
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
/** Mango selector syntax.
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#selector-syntax} */
export type MangoSelector = {
  [K in MangoOperator | string]:
    | MangoSelector
    | MangoSelector[]
    | MangoValue
    | MangoValue[];
};

/** Mango sort syntax
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#sort-syntax} */
export type SortOrder = string | string[] | { [key: string]: "asc" | "desc" };

/** Mango query syntax.
 * @see Docs: {@link https://docs.couchdb.org/en/latest/api/database/find.html#db-find}  */
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

/** Database authentication response.
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/server/authn.html#cookie-authentication} */
export interface DatabaseAuthResponse {
  /** Operation status */
  ok: boolean;

  /** Username */
  name: string;

  /** List of user roles */
  roles: string[];
}

/** Database _session response.
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/server/authn.html#get--_session} */
export interface DatabaseSessionResponse {
  /** Operation status */
  ok: boolean;

  /** User context for the current user */
  userCtx: any;

  /** Server authentication configuration */
  info: any;
}

// -------------------------------------
// Document
// -------------------------------------

export interface MaybeIdentifiedDocument {
  _id?: string;
}

export interface IdentifiedDocument {
  _id: string;
}

export interface MaybeRevisionedDocument {
  _rev?: string;
}

export interface RevisionedDocument {
  _rev: string;
}

export interface MaybeDocument
  extends MaybeIdentifiedDocument,
    MaybeRevisionedDocument {}

export interface Document extends IdentifiedDocument, RevisionedDocument {}

// -------------------------------------
// View
// -------------------------------------

export type DocumentInfer<D> = (doc: D & Document) => void;
export interface View<D> {
  map?: string | DocumentInfer<D>;
  reduce?: string | DocumentInfer<D>;
}

export interface ViewDocument<D> extends IdentifiedDocument {
  views: {
    [name: string]: View<D>;
  };
}

/** Document insert parameters.
 * @see POST docs: {@link http://docs.couchdb.org/en/latest/api/database/common.html#post--db}
 * @see PUT docs: {@link http://docs.couchdb.org/en/latest/api/document/common.html#put--db-docid} */
export interface DocumentInsertParams {
  /** Document ID */
  docName?: string;

  /** Document’s revision if updating an existing document. Alternative to If-Match header or document key. */
  rev?: string;

  /** Stores document in batch mode. */
  batch?: "ok";

  /** Prevents insertion of a conflicting document.
   *
   * If false, a well-formed `_rev` must be included in the document. `new_edits=false` is used by the replicator to
   * insert documents into the target database even if that leads to the creation of conflicts.
   *
   * @default true */
  new_edits?: boolean;
}

/** Document get parameters.
 * @see Docs: {@link http://docs.couchdb.org/en/latest/api/document/common.html#get--db-docid} */
export interface DocumentGetParams {
  /** Includes attachments bodies in response.
   *
   * @default false */
  attachments?: boolean;

  /** Includes encoding information in attachment stubs if the particular attachment is compressed.
   *
   * @default false */
  att_encoding_info?: boolean;

  /** Includes attachments only since specified revisions.
   *
   * Doesn’t includes attachments for specified revisions. */
  atts_since?: any[];

  /** Includes information about conflicts in document.
   *
   * @default false */
  conflicts?: boolean;

  /** Includes information about deleted conflicted revisions.
   *
   * @default false */
  deleted_conflicts?: boolean;

  /** Forces retrieving latest “leaf” revision, no matter what rev was requested.
   *
   * @default false */
  latest?: boolean;

  /** Includes last update sequence for the document.
   *
   * @default false */
  local_seq?: boolean;

  /** Acts same as specifying all conflicts, deleted_conflicts and revs_info query parameters.
   *
   * @default false */
  meta?: boolean;

  /** Retrieves documents of specified leaf revisions.
   *
   * Additionally, it accepts value as all to return all leaf revisions. */
  open_revs?: any[];

  /** Retrieves document of specified revision. */
  rev?: string;

  /** Includes list of all known document revisions. */
  revs?: boolean;

  /** Includes detailed information for all known document revisions.
   *
   * @default false */
  revs_info?: boolean;
}

/** Server scope */
export interface ServerScope {
  /**
   * Returns a database object that allows you to perform operations against that database.
   * @see README: {@link https://www.npmjs.com/package/nano#nanousename}
   */
  use<D>(db: string): DocumentScope<D>;
  /**
   * Initiates new session for specified user credentials by providing Cookie value.
   * @see Docs: {@link http://docs.couchdb.org/en/latest/api/server/authn.html#cookie-authentication} */
  auth(username: string, userpass: string): Promise<DatabaseAuthResponse>;
  /**
   * Returns information about the authenticated user, including a User Context Object, the authentication method and database that were used, and a list of configured authentication handlers on the server.
   * @see Docs: {@link http://docs.couchdb.org/en/latest/api/server/authn.html#get--_session} */
  session(): Promise<DatabaseSessionResponse>;
}

/** Documents scope */
export interface DocumentScope<D> {
  /** Initiates new session for specified user credentials by providing Cookie value.
   * @see Docs: {@link http://docs.couchdb.org/en/latest/api/server/authn.html#cookie-authentication} */
  auth(username: string, userpass: string): Promise<DatabaseAuthResponse>;
  /** Returns information about the authenticated user, including a User Context Object, the authentication method and database that were used, and a list of configured authentication handlers on the server.
   * @see Docs: {@link http://docs.couchdb.org/en/latest/api/server/authn.html#get--_session} */
  session(): Promise<DatabaseSessionResponse>;
  /** Insert a document into this database.
   * @see POST Docs: {@link http://docs.couchdb.org/en/latest/api/database/common.html#post--db}
   * @see PUT Docs: {@link http://docs.couchdb.org/en/latest/api/document/common.html#put--db-docid} */
  insert(
    document: ViewDocument<D> | (D & MaybeDocument)
  ): Promise<DocumentInsertResponse>;
  /**
   * Insert a document into this database with options.
   * @see POST Docs: {@link http://docs.couchdb.org/en/latest/api/database/common.html#post--db}
   * @see PUT Docs: {@link http://docs.couchdb.org/en/latest/api/document/common.html#put--db-docid} */
  insert(
    document: ViewDocument<D> | (D & MaybeDocument),
    params: DocumentInsertParams | string | null
  ): Promise<DocumentInsertResponse>;
  /** Fetch a document from this database.
   * @see Docs: {@link http://docs.couchdb.org/en/latest/api/document/common.html#get--db-docid} */
  get(docname: string): Promise<DocumentGetResponse & D>;
  /** Fetch a document from this database with options.
   * @see Docs: {@link http://docs.couchdb.org/en/latest/api/document/common.html#get--db-docid} */
  get(
    docname: string,
    params?: DocumentGetParams
  ): Promise<DocumentGetResponse & D>;
  /** Delete a document from this database.
   * @see Docs: {@link http://docs.couchdb.org/en/latest/api/document/common.html#delete--db-docid} */
  destroy(docname: string, rev: string): Promise<DocumentDestroyResponse>;
  /** Bulk insert/update/delete multiple documents in this database.
   * @see Docs: {@link https://docs.couchdb.org/en/stable/api/database/bulk-api.html#db-bulk-docs} */
  bulk(docs: BulkModifyDocsWrapper): Promise<DocumentBulkResponse[]>;
  /** Bulk insert/update/delete multiple documents in this database, with options.
   * @see Docs: {@link https://docs.couchdb.org/en/stable/api/database/bulk-api.html#db-bulk-docs} */
  bulk(
    docs: BulkModifyDocsWrapper,
    params: any
  ): Promise<DocumentInsertResponse[]>;
  /** Create a Mango index.
   * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#db-index} */
  createIndex(indexDef: CreateIndexRequest): Promise<CreateIndexResponse>;

  /** Run Mango query.
   * @see Docs: {@link http://docs.couchdb.org/en/latest/api/database/find.html#db-find} */
  find(query: MangoQuery): Promise<MangoResponse<D>>;
  /** Server scope */
  server: ServerScope;
}
