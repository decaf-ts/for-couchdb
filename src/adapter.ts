import {
  Adapter,
  PersistenceKeys,
  ConnectionError,
  Paginator,
  RawResult,
  ContextualArgs,
  FlagsOf,
  MaybeContextualArg,
  PreparedModel,
} from "@decaf-ts/core";
import { CouchDBKeys, reservedAttributes } from "./constants";
import {
  BaseError,
  ConflictError,
  ComposedFromMetadata,
  InternalError,
  NotFoundError,
  OperationKeys,
  prefixMethod,
  type PrimaryKeyType,
} from "@decaf-ts/db-decorators";
import { Model } from "@decaf-ts/decorator-validation";
import { IndexError } from "./errors";
import { type MangoQuery, ViewResponse, CouchDBFlags } from "./types";
import { CouchDBPaginator, CouchDBStatement } from "./query";
import { Context } from "@decaf-ts/core";
import { type Constructor } from "@decaf-ts/decoration";
import { final } from "@decaf-ts/logging";
import { CouchDBRepository } from "./repository";
import { getMetadata, removeMetadata, setMetadata } from "./metadata";
import { Repository } from "@decaf-ts/core";
import { extractEqualityFilters } from "./query/selector-utils";
import { decomposePrimaryKeySegments } from "./query/id-utils";

/**
 * @description Abstract adapter for CouchDB database operations
 * @summary Provides a base implementation for CouchDB database operations, including CRUD operations, sequence management, and error handling
 * @template Y - The scope type
 * @template F - The repository flags type
 * @template C - The context type
 * @param {Y} scope - The scope for the adapter
 * @param {string} flavour - The flavour of the adapter
 * @param {string} [alias] - Optional alias for the adapter
 * @class
 * @example
 * // Example of extending CouchDBAdapter
 * class MyCouchDBAdapter extends CouchDBAdapter<MyScope, MyFlags, MyContext> {
 *   constructor(scope: MyScope) {
 *     super(scope, 'my-couchdb', 'my-alias');
 *   }
 *
 *   // Implement abstract methods
 *   async index<M extends Model>(...models: Constructor<M>[]): Promise<void> {
 *     // Implementation
 *   }
 *
 *   async raw<R>(rawInput: MangoQuery, docsOnly: boolean): Promise<R> {
 *     // Implementation
 *   }
 *
 *   async create(tableName: string, id: string | number, model: Record<string, any>, ...args: any[]): Promise<Record<string, any>> {
 *     // Implementation
 *   }
 *
 *   async read(tableName: string, id: string | number, ...args: any[]): Promise<Record<string, any>> {
 *     // Implementation
 *   }
 *
 *   async update(tableName: string, id: string | number, model: Record<string, any>, ...args: any[]): Promise<Record<string, any>> {
 *     // Implementation
 *   }
 *
 *   async delete(tableName: string, id: string | number, ...args: any[]): Promise<Record<string, any>> {
 *     // Implementation
 *   }
 * }
 */
type GenerateIdOptions<M extends Model = Model> = {
  clazz?: Constructor<M>;
  ctx?: Context<CouchDBFlags>;
};

type NativeIndexPlan = {
  tableName: string;
  clazz: Constructor<Model>;
  startkey: string;
  endkey?: string;
  inclusiveEnd: boolean;
  descending: boolean;
  limit?: number;
  skip?: number;
};

export abstract class CouchDBAdapter<
  CONF,
  CONN,
  C extends Context<CouchDBFlags>,
> extends Adapter<CONF, CONN, MangoQuery, C> {
  private tableModelCache?: Map<string, Constructor<Model>>;
  protected constructor(scope: CONF, flavour: string, alias?: string) {
    super(scope, flavour, alias);
    [this.create, this.createAll, this.update, this.updateAll].forEach((m) => {
      const name = m.name;
      prefixMethod(this, m, (this as any)[name + "Prefix"]);
    });
  }

  /**
   * @description Creates a new CouchDB statement for querying
   * @summary Factory method that creates a new CouchDBStatement instance for building queries
   * @template M - The model type
   * @return {CouchDBStatement<M, any>} A new CouchDBStatement instance
   */
  @final()
  Statement<M extends Model>(): CouchDBStatement<
    M,
    Adapter<CONF, CONN, MangoQuery, C>,
    any
  > {
    return new CouchDBStatement(this);
  }

  override Paginator<M extends Model>(
    query: MangoQuery,
    size: number,
    clazz: Constructor<M>
  ): Paginator<M, any, MangoQuery> {
    return new CouchDBPaginator(this, query, size, clazz);
  }

  /**
   * @description Initializes the adapter by creating indexes for all managed models
   * @summary Sets up the necessary database indexes for all models managed by this adapter
   * @return {Promise<void>} A promise that resolves when initialization is complete
   */
  override async initialize(): Promise<void> {
    const managedModels = Adapter.models(this.flavour);
    return this.index(...managedModels);
  }

  override repository<
    R extends Repository<any, Adapter<CONF, CONN, MangoQuery, C>>,
  >(): Constructor<R> {
    return CouchDBRepository as unknown as Constructor<R>;
  }

  protected getModelByTable(
    tableName: string
  ): Constructor<Model> | undefined {
    if (!this.tableModelCache) {
      const models = Adapter.models(this.flavour);
      this.tableModelCache = new Map(
        models.map((ctor) => [Model.tableName(ctor), ctor])
      );
    }
    return this.tableModelCache.get(tableName);
  }

  protected override async flags<M extends Model>(
    operation: OperationKeys | string,
    model: Constructor<M> | Constructor<M>[] | undefined,
    flags: Partial<FlagsOf<C>>,
    ...args: MaybeContextualArg<C>
  ): Promise<FlagsOf<C>> {
    const resolved = (await super.flags(
      operation,
      model,
      flags,
      ...args
    )) as FlagsOf<C> & CouchDBFlags;
    if (typeof resolved.nativeIndexing === "undefined") {
      resolved.nativeIndexing = false;
    }
    return resolved;
  }

  /**
   * @description Creates indexes for the given models
   * @summary Abstract method that must be implemented to create database indexes for the specified models
   * @template M - The model type
   * @param {...Constructor<M>} models - The model constructors to create indexes for
   * @return {Promise<void>} A promise that resolves when all indexes are created
   */
  protected abstract index<M extends Model>(
    ...models: Constructor<M>[]
  ): Promise<void>;

  /**
   * @description Executes a raw Mango query against the database
   * @summary Abstract method that must be implemented to execute raw Mango queries. Implementations may treat the first
   * additional argument as a boolean `docsOnly` flag before the contextual arguments provided by repositories.
   * @template R - The result type
   * @param {MangoQuery} rawInput - The raw Mango query to execute
   * @param {...MaybeContextualArg<C>} args - Optional `docsOnly` flag followed by contextual arguments
   * @return {Promise<R>} A promise that resolves to the query result
   */
  abstract override raw<R, D extends boolean>(
    rawInput: MangoQuery,
    docsOnly: D,
    ...args: ContextualArgs<C>
  ): Promise<RawResult<R, D>>;

  /**
   * @description Executes a CouchDB view query
   * @summary Invokes a design document view and returns its response
   * @template R - The view response type
   * @param {string} ddoc - Design document name
   * @param {string} view - View name
   * @param {Record<string, any>} options - Mango query options
   * @param {...ContextualArgs<C>} args - Optional contextual arguments
   * @return {Promise<ViewResponse<R>>} The view response
   */
  abstract view<R>(
    ddoc: string,
    view: string,
    options: Record<string, any>,
    ...args: ContextualArgs<C>
  ): Promise<ViewResponse<R>>;

  /**
   * @description Assigns metadata to a model
   * @summary Adds revision metadata to a model as a non-enumerable property
   * @param {Record<string, any>} model - The model to assign metadata to
   * @param {string} rev - The revision string to assign
   * @return {Record<string, any>} The model with metadata assigned
   */
  @final()
  protected assignMetadata(
    model: Record<string, any>,
    rev: string
  ): Record<string, any> {
    if (!rev) return model;
    setMetadata(model as any, rev);
    return model;
  }

  /**
   * @description Assigns metadata to multiple models
   * @summary Adds revision metadata to multiple models as non-enumerable properties
   * @param models - The models to assign metadata to
   * @param {string[]} revs - The revision strings to assign
   * @return The models with metadata assigned
   */
  @final()
  protected assignMultipleMetadata(
    models: Record<string, any>[],
    revs: string[]
  ): Record<string, any>[] {
    models.forEach((m, i) => {
      setMetadata(m as any, revs[i]);
      return m;
    });
    return models;
  }

  override prepare<M extends Model>(
    model: M,
    ...args: ContextualArgs<C>
  ): PreparedModel {
    const { log } = this.logCtx(args, this.prepare);
    const split = model.segregate();
    const result = Object.entries(split.model).reduce(
      (accum: Record<string, any>, [key, val]) => {
        if (typeof val === "undefined") return accum;
        const mappedProp: string = Model.columnName(
          model.constructor as Constructor<M>,
          key as keyof M
        );
        if (this.isReserved(mappedProp))
          throw new InternalError(`Property name ${mappedProp} is reserved`);
        val = val instanceof Date ? new Date(val) : val;
        accum[mappedProp] = val;
        return accum;
      },
      {}
    );
    if ((model as any)[PersistenceKeys.METADATA]) {
      // TODO movo to couchdb
      log.silly(
        `Passing along persistence metadata for ${(model as any)[PersistenceKeys.METADATA]}`
      );
      Object.defineProperty(result, PersistenceKeys.METADATA, {
        enumerable: false,
        writable: true,
        configurable: true,
        value: (model as any)[PersistenceKeys.METADATA],
      });
    }

    return {
      record: result,
      id: model[Model.pk(model.constructor as Constructor<M>)] as string,
      transient: split.transient,
    };
  }

  /**
   * @description Prepares a record for creation
   * @summary Adds necessary CouchDB fields to a record before creation
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {Record<string, any>} model - The model to prepare
   * @return A tuple containing the tableName, id, and prepared record
   */
  @final()
  protected createPrefix<M extends Model>(
    clazz: Constructor<M>,
    id: PrimaryKeyType,
    model: Record<string, any>,
    ...args: ContextualArgs<C>
  ): [Constructor<M>, PrimaryKeyType, Record<string, any>, ...any[], Context] {
    const { ctx, ctxArgs } = this.logCtx(args, this.createPrefix);
    const tableName = Model.tableName(clazz);
    const record: Record<string, any> = {};
    record[CouchDBKeys.TABLE] = tableName;
    record[CouchDBKeys.ID] = this.generateId(tableName, id as any, {
      clazz,
      ctx,
    });
    Object.assign(record, model);
    return [clazz, id, record, ...ctxArgs];
  }

  /**
   * @description Creates a new record in the database
   * @summary Abstract method that must be implemented to create a new record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {Record<string, any>} model - The model to create
   * @param {...any[]} args - Additional arguments
   * @return {Promise<Record<string, any>>} A promise that resolves to the created record
   */
  abstract override create<M extends Model>(
    tableName: Constructor<M>,
    id: PrimaryKeyType,
    model: Record<string, any>,
    ...args: ContextualArgs<C>
  ): Promise<Record<string, any>>;

  /**
   * @description Prepares multiple records for creation
   * @summary Adds necessary CouchDB fields to multiple records before creation
   * @param {string} tableName - The name of the table
   * @param {string[]|number[]} ids - The IDs of the records
   * @param models - The models to prepare
   * @return A tuple containing the tableName, ids, and prepared records
   * @throws {InternalError} If ids and models arrays have different lengths
   */
  @final()
  protected createAllPrefix<M extends Model>(
    clazz: Constructor<M>,
    ids: string[] | number[],
    models: Record<string, any>[],
    ...args: ContextualArgs<C>
  ) {
    const tableName = Model.tableName(clazz);
    if (ids.length !== models.length)
      throw new InternalError("Ids and models must have the same length");
    const { ctx, ctxArgs } = this.logCtx(args, this.createAllPrefix);
    const records = ids.map((id, count) => {
      const record: Record<string, any> = {};
      record[CouchDBKeys.TABLE] = tableName;
      record[CouchDBKeys.ID] = this.generateId(tableName, id, {
        clazz,
        ctx,
      });
      Object.assign(record, models[count]);
      return record;
    });
    return [clazz, ids, records, ...ctxArgs];
  }

  /**
   * @description Reads a record from the database
   * @summary Abstract method that must be implemented to read a record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {...any[]} args - Additional arguments
   * @return {Promise<Record<string, any>>} A promise that resolves to the read record
   */
  abstract override read<M extends Model>(
    tableName: Constructor<M>,
    id: PrimaryKeyType,
    ...args: ContextualArgs<C>
  ): Promise<Record<string, any>>;

  /**
   * @description Prepares a record for update
   * @summary Adds necessary CouchDB fields to a record before update
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param model - The model to prepare
   * @param [args] - optional args for subclassing
   * @return A tuple containing the tableName, id, and prepared record
   * @throws {InternalError} If no revision number is found in the model
   */
  @final()
  updatePrefix<M extends Model>(
    clazz: Constructor<M>,
    id: PrimaryKeyType,
    model: Record<string, any>,
    ...args: ContextualArgs<C>
  ) {
    const tableName = Model.tableName(clazz);
    const { ctx, ctxArgs } = this.logCtx(args, this.updatePrefix);
    const record: Record<string, any> = {};
    record[CouchDBKeys.TABLE] = tableName;
    record[CouchDBKeys.ID] = this.generateId(tableName, id, {
      clazz,
      ctx,
    });
    const rev = model[PersistenceKeys.METADATA];
    if (!rev)
      throw new InternalError(
        `No revision number found for record with id ${id}`
      );
    Object.assign(record, model);
    record[CouchDBKeys.REV] = rev;
    return [clazz, id, record, ...ctxArgs];
  }

  /**
   * @description Updates a record in the database
   * @summary Abstract method that must be implemented to update a record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {Record<string, any>} model - The model to update
   * @param {any[]} args - Additional arguments
   * @return A promise that resolves to the updated record
   */
  abstract override update<M extends Model>(
    tableName: Constructor<M>,
    id: PrimaryKeyType,
    model: Record<string, any>,
    ...args: ContextualArgs<C>
  ): Promise<Record<string, any>>;

  /**
   * @description Prepares multiple records for update
   * @summary Adds necessary CouchDB fields to multiple records before update
   * @param {string} tableName - The name of the table
   * @param {string[]|number[]} ids - The IDs of the records
   * @param models - The models to prepare
   * @return A tuple containing the tableName, ids, and prepared records
   * @throws {InternalError} If ids and models arrays have different lengths or if no revision number is found in a model
   */
  @final()
  protected updateAllPrefix<M extends Model>(
    clazz: Constructor<M>,
    ids: PrimaryKeyType[],
    models: Record<string, any>[],
    ...args: ContextualArgs<C>
  ) {
    const tableName = Model.tableName(clazz);
    if (ids.length !== models.length)
      throw new InternalError("Ids and models must have the same length");
    const { ctx, ctxArgs } = this.logCtx(args, this.updateAllPrefix);
    const records = ids.map((id, count) => {
      const record: Record<string, any> = {};
      record[CouchDBKeys.TABLE] = tableName;
      record[CouchDBKeys.ID] = this.generateId(tableName, id, {
        clazz,
        ctx,
      });
      const rev = models[count][PersistenceKeys.METADATA];
      if (!rev)
        throw new InternalError(
          `No revision number found for record with id ${id}`
        );
      Object.assign(record, models[count]);
      record[CouchDBKeys.REV] = rev;
      return record;
    });
    return [clazz, ids, records, ...ctxArgs];
  }

  /**
   * @description Deletes a record from the database
   * @summary Abstract method that must be implemented to delete a record
   * @param {Constructor<M>} tableName - The name of the table
   * @param {PrimaryKeyType} id - The ID of the record
   * @param {any[]} args - Additional arguments
   * @return A promise that resolves to the deleted record
   */
  abstract override delete<M extends Model>(
    tableName: Constructor<M>,
    id: PrimaryKeyType,
    ...args: ContextualArgs<C>
  ): Promise<Record<string, any>>;

  /**
   * @description Generates a CouchDB document ID
   * @summary Combines the table name and ID to create a CouchDB document ID
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @return {string} The generated CouchDB document ID
   */
  protected generateId<M extends Model>(
    tableName: string,
    id: PrimaryKeyType,
    options?: GenerateIdOptions<M>
  ) {
    const ctx = options?.ctx;
    const clazz = options?.clazz;
    if (!this.hasNativeIndexing(ctx) || !clazz) {
      return [tableName, id].join(CouchDBKeys.SEPARATOR);
    }
    const pk = Model.pk(clazz) as keyof M;
    const segments =
      decomposePrimaryKeySegments(clazz, pk, id) || undefined;
    if (!segments || !segments.length) {
      return [tableName, id].join(CouchDBKeys.SEPARATOR);
    }
    return [tableName, ...segments].join(CouchDBKeys.SEPARATOR);
  }

  protected resolveNativeIndexPlan(
    query: MangoQuery,
    ctx: Context<CouchDBFlags>
  ): NativeIndexPlan | undefined {
    if (!this.hasNativeIndexing(ctx)) return undefined;
    if (!query?.selector || (query.fields && query.fields.length)) {
      return undefined;
    }
    const filters = extractEqualityFilters(query.selector);
    if (!filters) return undefined;
    const tableName = filters[CouchDBKeys.TABLE];
    if (typeof tableName !== "string" || !tableName.length) return undefined;
    const clazz = this.getModelByTable(tableName);
    if (!clazz) return undefined;
    const pkAttr = Model.pk(clazz) as string;
    const normalized = Object.assign({}, filters);
    delete normalized[CouchDBKeys.TABLE];
    const composed = Model.composed(
      clazz,
      pkAttr as keyof Model
    ) as ComposedFromMetadata | undefined;
    const componentNames = composed ? composed.args.slice() : [pkAttr];
    const prefixValues: (string | undefined)[] = new Array(
      componentNames.length
    ).fill(undefined);
    if (typeof normalized[pkAttr] !== "undefined") {
      const pkValue = normalized[pkAttr];
      const segments = composed
        ? decomposePrimaryKeySegments(
            clazz,
            pkAttr as keyof Model,
            pkValue as PrimaryKeyType
          )
        : [String(pkValue)];
      if (segments) {
        segments.forEach((segment, index) => {
          if (index < prefixValues.length) {
            prefixValues[index] = segment;
          }
        });
      }
      delete normalized[pkAttr];
    }
    componentNames.forEach((name, index) => {
      if (typeof normalized[name] !== "undefined") {
        prefixValues[index] = String(normalized[name]);
        delete normalized[name];
      }
    });
    const remainingKeys = Object.keys(normalized);
    if (remainingKeys.length) return undefined;
    let encounteredUndefined = false;
    for (const value of prefixValues) {
      if (typeof value === "undefined") encounteredUndefined = true;
      else if (encounteredUndefined) return undefined;
    }
    const definedValues = prefixValues.filter(
      (val): val is string => typeof val !== "undefined"
    );
    const definedCount = definedValues.length;
    const sep = CouchDBKeys.SEPARATOR;
    const fullPrefix =
      definedCount > 0 ? [tableName, ...definedValues].join(sep) : tableName;
    let startkey: string;
    let endkey: string | undefined;
    if (componentNames.length === 0 || definedCount === 0) {
      const base = `${tableName}${sep}`;
      startkey = base;
      endkey = `${base}\ufff0`;
    } else if (definedCount === componentNames.length) {
      startkey = fullPrefix;
      endkey = fullPrefix;
    } else {
      const base = `${fullPrefix}${sep}`;
      startkey = base;
      endkey = `${base}\ufff0`;
    }
    const sort = Array.isArray(query.sort) ? query.sort : undefined;
    let descending = false;
    if (sort && sort.length) {
      if (sort.length > 1) return undefined;
      const entry = sort[0];
      const sortField = Object.keys(entry)[0];
      if (!sortField || sortField !== pkAttr) return undefined;
      const dir = String(
        (entry as Record<string, any>)[sortField] ?? "asc"
      ).toLowerCase();
      descending = dir === "desc";
    }
    if (descending && endkey) {
      const originalStart = startkey;
      startkey = endkey;
      endkey = originalStart;
    }
    return {
      tableName,
      clazz,
      startkey,
      endkey,
      inclusiveEnd: true,
      descending,
      limit: query.limit,
      skip: query.skip,
    };
  }

  nativeIndexPlan(
    query: MangoQuery,
    ctx: Context<CouchDBFlags>
  ): NativeIndexPlan | undefined {
    return this.resolveNativeIndexPlan(query, ctx);
  }

  protected hasNativeIndexing(
    ctx?: Context<CouchDBFlags>
  ): boolean {
    if (!ctx) return false;
    if (typeof (ctx as Context<CouchDBFlags>).getOrUndefined === "function") {
      const flag = ctx.getOrUndefined("nativeIndexing");
      return !!flag;
    }
    try {
      return !!ctx.get("nativeIndexing" as keyof CouchDBFlags);
    } catch {
      return false;
    }
  }

  /**
   * @description Parses an error and converts it to a BaseError
   * @summary Converts various error types to appropriate BaseError subtypes
   * @param {Error|string} err - The error to parse
   * @param {string} [reason] - Optional reason for the error
   * @return {BaseError} The parsed error as a BaseError
   */
  parseError<E extends BaseError>(err: Error | string, reason?: string): E {
    return CouchDBAdapter.parseError(err, reason);
  }

  /**
   * @description Checks if an attribute is reserved
   * @summary Determines if an attribute name is reserved in CouchDB
   * @param {string} attr - The attribute name to check
   * @return {boolean} True if the attribute is reserved, false otherwise
   */
  protected override isReserved(attr: string): boolean {
    return !!attr.match(reservedAttributes);
  }

  /**
   * @description Static method to parse an error and convert it to a BaseError
   * @summary Converts various error types to appropriate BaseError subtypes based on error codes and messages
   * @param {Error|string} err - The error to parse
   * @param {string} [reason] - Optional reason for the error
   * @return {BaseError} The parsed error as a BaseError
   * @mermaid
   * sequenceDiagram
   *   participant Caller
   *   participant parseError
   *   participant ErrorTypes
   *
   *   Caller->>parseError: err, reason
   *   Note over parseError: Check if err is already a BaseError
   *   alt err is BaseError
   *     parseError-->>Caller: return err
   *   else err is string
   *     Note over parseError: Extract code from string
   *     alt code matches "already exist|update conflict"
   *       parseError->>ErrorTypes: new ConflictError(code)
   *       ErrorTypes-->>Caller: ConflictError
   *     else code matches "missing|deleted"
   *       parseError->>ErrorTypes: new NotFoundError(code)
   *       ErrorTypes-->>Caller: NotFoundError
   *     end
   *   else err has code property
   *     Note over parseError: Extract code and reason
   *   else err has statusCode property
   *     Note over parseError: Extract code and reason
   *   else
   *     Note over parseError: Use err.message as code
   *   end
   *
   *   Note over parseError: Switch on code
   *   alt code is 401, 412, or 409
   *     parseError->>ErrorTypes: new ConflictError(reason)
   *     ErrorTypes-->>Caller: ConflictError
   *   else code is 404
   *     parseError->>ErrorTypes: new NotFoundError(reason)
   *     ErrorTypes-->>Caller: NotFoundError
   *   else code is 400
   *     alt code matches "No index exists"
   *       parseError->>ErrorTypes: new IndexError(err)
   *       ErrorTypes-->>Caller: IndexError
   *     else
   *       parseError->>ErrorTypes: new InternalError(err)
   *       ErrorTypes-->>Caller: InternalError
   *     end
   *   else code matches "ECONNREFUSED"
   *     parseError->>ErrorTypes: new ConnectionError(err)
   *     ErrorTypes-->>Caller: ConnectionError
   *   else
   *     parseError->>ErrorTypes: new InternalError(err)
   *     ErrorTypes-->>Caller: InternalError
   *   end
   */
  protected static parseError<E extends BaseError>(
    err: Error | string,
    reason?: string
  ): E {
    if (err instanceof BaseError) return err as any;
    let code: string = "";
    if (typeof err === "string") {
      code = err;
      if (code.match(/already exist|update conflict/g))
        return new ConflictError(code) as E;
      if (code.match(/missing|deleted/g)) return new NotFoundError(code) as E;
    } else if ((err as any).code) {
      code = (err as any).code;
      reason = reason || err.message;
    } else if ((err as any).statusCode) {
      code = (err as any).statusCode;
      reason = reason || err.message;
    } else {
      code = err.message;
    }

    switch (code.toString()) {
      case "401":
      case "412":
      case "409":
        return new ConflictError(reason as string) as E;
      case "404":
        return new NotFoundError(reason as string) as E;
      case "400":
        if (code.toString().match(/No\sindex\sexists/g))
          return new IndexError(err) as E;
        return new InternalError(err) as E;
      default:
        if (code.toString().match(/ECONNREFUSED/g))
          return new ConnectionError(err) as E;
        return new InternalError(err) as E;
    }
  }

  // TODO why do we need this?
  /**
   * @description Sets metadata on a model instance.
   * @summary Attaches metadata to a model instance using a non-enumerable property.
   * @template M - The model type that extends Model.
   * @param {M} model - The model instance.
   * @param {any} metadata - The metadata to attach to the model.
   */
  static setMetadata<M extends Model>(model: M, metadata: any) {
    setMetadata(model, metadata);
  }

  /**
   * @description Gets metadata from a model instance.
   * @summary Retrieves previously attached metadata from a model instance.
   * @template M - The model type that extends Model.
   * @param {M} model - The model instance.
   * @return {any} The metadata or undefined if not found.
   */
  static getMetadata<M extends Model>(model: M) {
    return getMetadata(model);
  }

  /**
   * @description Removes metadata from a model instance.
   * @summary Deletes the metadata property from a model instance.
   * @template M - The model type that extends Model.
   * @param {M} model - The model instance.
   */
  static removeMetadata<M extends Model>(model: M) {
    removeMetadata(model);
  }
}
