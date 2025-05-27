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

  @final()
  Statement<M extends Model>(): CouchDBStatement<M, any> {
    return new CouchDBStatement(this);
  }

  @final()
  async Sequence(options: SequenceOptions): Promise<Sequence> {
    return new CouchDBSequence(options, this);
  }

  async initialize(): Promise<void> {
    const managedModels = Adapter.models(this.flavour);
    return this.index(...managedModels);
  }

  protected abstract index<M extends Model>(
    ...models: Constructor<M>[]
  ): Promise<void>;

  abstract override raw<R>(rawInput: MangoQuery, docsOnly: boolean): Promise<R>;

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

  abstract override create(
    tableName: string,
    id: string | number,
    model: Record<string, any>,
    ...args: any[]
  ): Promise<Record<string, any>>;

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

  abstract override read(
    tableName: string,
    id: string | number,
    ...args: any[]
  ): Promise<Record<string, any>>;

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

  abstract override update(
    tableName: string,
    id: string | number,
    model: Record<string, any>,
    ...args: any[]
  ): Promise<Record<string, any>>;

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

  abstract override delete(
    tableName: string,
    id: string | number,
    ...args: any[]
  ): Promise<Record<string, any>>;

  protected generateId(tableName: string, id: string | number) {
    return [tableName, id].join(CouchDBKeys.SEPARATOR);
  }

  parseError(err: Error | string, reason?: string): BaseError {
    return CouchDBAdapter.parseError(err, reason);
  }

  protected override isReserved(attr: string): boolean {
    return !!attr.match(reservedAttributes);
  }

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
