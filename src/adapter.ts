import {
  Adapter,
  Sequence,
  type SequenceOptions,
  PersistenceKeys,
  ConnectionError,
  Repository,
} from "@decaf-ts/core";
import { CouchDBKeys, reservedAttributes } from "./constants";
import {
  BaseError,
  ConflictError,
  Context,
  InternalError,
  NotFoundError,
  prefixMethod,
  RepositoryFlags,
} from "@decaf-ts/db-decorators";
import "reflect-metadata";

import { CouchDBSequence } from "./sequences/Sequence";
import { Constructor, Model } from "@decaf-ts/decorator-validation";
import { IndexError } from "./errors";
import { MangoQuery } from "./types";
import { CouchDBStatement } from "./query";
import { final } from "@decaf-ts/core";

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
export abstract class CouchDBAdapter<
  Y,
  F extends RepositoryFlags,
  C extends Context<F>,
> extends Adapter<Y, MangoQuery, F, C> {
  protected constructor(scope: Y, flavour: string, alias?: string) {
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
  Statement<M extends Model>(): CouchDBStatement<M, any> {
    return new CouchDBStatement(this);
  }

  /**
   * @description Creates a new CouchDB sequence
   * @summary Factory method that creates a new CouchDBSequence instance for managing sequences
   * @param {SequenceOptions} options - The options for the sequence
   * @return {Promise<Sequence>} A promise that resolves to a new Sequence instance
   */
  @final()
  async Sequence(options: SequenceOptions): Promise<Sequence> {
    return new CouchDBSequence(options, this);
  }

  /**
   * @description Initializes the adapter by creating indexes for all managed models
   * @summary Sets up the necessary database indexes for all models managed by this adapter
   * @return {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    const managedModels = Adapter.models(this.flavour);
    return this.index(...managedModels);
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
   * @summary Abstract method that must be implemented to execute raw Mango queries
   * @template R - The result type
   * @param {MangoQuery} rawInput - The raw Mango query to execute
   * @param {boolean} docsOnly - Whether to return only the documents or the full response
   * @return {Promise<R>} A promise that resolves to the query result
   */
  abstract override raw<R>(rawInput: MangoQuery, docsOnly: boolean): Promise<R>;

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
    Object.defineProperty(model, PersistenceKeys.METADATA, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: rev,
    });
    return model;
  }

  /**
   * @description Assigns metadata to multiple models
   * @summary Adds revision metadata to multiple models as non-enumerable properties
   * @param {Record<string, any>[]} models - The models to assign metadata to
   * @param {string[]} revs - The revision strings to assign
   * @return {Record<string, any>[]} The models with metadata assigned
   */
  @final()
  protected assignMultipleMetadata(
    models: Record<string, any>[],
    revs: string[]
  ): Record<string, any>[] {
    models.forEach((m, i) => {
      Repository.setMetadata(m as any, revs[i]);
      return m;
    });
    return models;
  }

  /**
   * @description Prepares a record for creation
   * @summary Adds necessary CouchDB fields to a record before creation
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {Record<string, any>} model - The model to prepare
   * @return {[string, string|number, Record<string, any>]} A tuple containing the tableName, id, and prepared record
   */
  @final()
  protected createPrefix(
    tableName: string,
    id: string | number,
    model: Record<string, any>
  ) {
    const record: Record<string, any> = {};
    record[CouchDBKeys.TABLE] = tableName;
    record[CouchDBKeys.ID] = this.generateId(tableName, id);
    Object.assign(record, model);
    return [tableName, id, record];
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
  abstract override create(
    tableName: string,
    id: string | number,
    model: Record<string, any>,
    ...args: any[]
  ): Promise<Record<string, any>>;

  /**
   * @description Prepares multiple records for creation
   * @summary Adds necessary CouchDB fields to multiple records before creation
   * @param {string} tableName - The name of the table
   * @param {string[]|number[]} ids - The IDs of the records
   * @param {Record<string, any>[]} models - The models to prepare
   * @return {[string, string[]|number[], Record<string, any>[]]} A tuple containing the tableName, ids, and prepared records
   * @throws {InternalError} If ids and models arrays have different lengths
   */
  @final()
  protected createAllPrefix(
    tableName: string,
    ids: string[] | number[],
    models: Record<string, any>[]
  ) {
    if (ids.length !== models.length)
      throw new InternalError("Ids and models must have the same length");

    const records = ids.map((id, count) => {
      const record: Record<string, any> = {};
      record[CouchDBKeys.TABLE] = tableName;
      record[CouchDBKeys.ID] = this.generateId(tableName, id);
      Object.assign(record, models[count]);
      return record;
    });
    return [tableName, ids, records];
  }

  /**
   * @description Reads a record from the database
   * @summary Abstract method that must be implemented to read a record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {...any[]} args - Additional arguments
   * @return {Promise<Record<string, any>>} A promise that resolves to the read record
   */
  abstract override read(
    tableName: string,
    id: string | number,
    ...args: any[]
  ): Promise<Record<string, any>>;

  /**
   * @description Prepares a record for update
   * @summary Adds necessary CouchDB fields to a record before update
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {Record<string, any>} model - The model to prepare
   * @return {[string, string|number, Record<string, any>]} A tuple containing the tableName, id, and prepared record
   * @throws {InternalError} If no revision number is found in the model
   */
  @final()
  updatePrefix(
    tableName: string,
    id: string | number,
    model: Record<string, any>
  ) {
    const record: Record<string, any> = {};
    record[CouchDBKeys.TABLE] = tableName;
    record[CouchDBKeys.ID] = this.generateId(tableName, id);
    const rev = model[PersistenceKeys.METADATA];
    if (!rev)
      throw new InternalError(
        `No revision number found for record with id ${id}`
      );
    Object.assign(record, model);
    record[CouchDBKeys.REV] = rev;
    return [tableName, id, record];
  }

  /**
   * @description Updates a record in the database
   * @summary Abstract method that must be implemented to update a record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {Record<string, any>} model - The model to update
   * @param {...any[]} args - Additional arguments
   * @return {Promise<Record<string, any>>} A promise that resolves to the updated record
   */
  abstract override update(
    tableName: string,
    id: string | number,
    model: Record<string, any>,
    ...args: any[]
  ): Promise<Record<string, any>>;

  /**
   * @description Prepares multiple records for update
   * @summary Adds necessary CouchDB fields to multiple records before update
   * @param {string} tableName - The name of the table
   * @param {string[]|number[]} ids - The IDs of the records
   * @param {Record<string, any>[]} models - The models to prepare
   * @return {[string, string[]|number[], Record<string, any>[]]} A tuple containing the tableName, ids, and prepared records
   * @throws {InternalError} If ids and models arrays have different lengths or if no revision number is found in a model
   */
  @final()
  protected updateAllPrefix(
    tableName: string,
    ids: string[] | number[],
    models: Record<string, any>[]
  ) {
    if (ids.length !== models.length)
      throw new InternalError("Ids and models must have the same length");

    const records = ids.map((id, count) => {
      const record: Record<string, any> = {};
      record[CouchDBKeys.TABLE] = tableName;
      record[CouchDBKeys.ID] = this.generateId(tableName, id);
      const rev = models[count][PersistenceKeys.METADATA];
      if (!rev)
        throw new InternalError(
          `No revision number found for record with id ${id}`
        );
      Object.assign(record, models[count]);
      record[CouchDBKeys.REV] = rev;
      return record;
    });
    return [tableName, ids, records];
  }

  /**
   * @description Deletes a record from the database
   * @summary Abstract method that must be implemented to delete a record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {...any[]} args - Additional arguments
   * @return {Promise<Record<string, any>>} A promise that resolves to the deleted record
   */
  abstract override delete(
    tableName: string,
    id: string | number,
    ...args: any[]
  ): Promise<Record<string, any>>;

  /**
   * @description Generates a CouchDB document ID
   * @summary Combines the table name and ID to create a CouchDB document ID
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @return {string} The generated CouchDB document ID
   */
  protected generateId(tableName: string, id: string | number) {
    return [tableName, id].join(CouchDBKeys.SEPARATOR);
  }

  /**
   * @description Parses an error and converts it to a BaseError
   * @summary Converts various error types to appropriate BaseError subtypes
   * @param {Error|string} err - The error to parse
   * @param {string} [reason] - Optional reason for the error
   * @return {BaseError} The parsed error as a BaseError
   */
  parseError(err: Error | string, reason?: string): BaseError {
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
  protected static parseError(err: Error | string, reason?: string): BaseError {
    if (err instanceof BaseError) return err as any;
    let code: string = "";
    if (typeof err === "string") {
      code = err;
      if (code.match(/already exist|update conflict/g))
        return new ConflictError(code);
      if (code.match(/missing|deleted/g)) return new NotFoundError(code);
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
        return new ConflictError(reason as string);
      case "404":
        return new NotFoundError(reason as string);
      case "400":
        if (code.toString().match(/No\sindex\sexists/g))
          return new IndexError(err);
        return new InternalError(err);
      default:
        if (code.toString().match(/ECONNREFUSED/g))
          return new ConnectionError(err);
        return new InternalError(err);
    }
  }
}
