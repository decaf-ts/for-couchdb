import {
  Adapter,
  getPersistenceKey,
  PersistenceKeys,
  Sequence,
  SequenceOptions,
} from "@decaf-ts/core";
import { Constructor } from "@decaf-ts/decorator-validation";
import {
  MangoQuery,
  DocumentScope,
  DocumentInsertResponse,
  DocumentGetResponse,
  ServerScope,
  DatabaseCreateResponse,
  MaybeDocument,
  MangoResponse,
} from "nano";
import * as Nano from "nano";
import { CouchDBKeys, reservedAttributes } from "./constants";
import {
  BaseError,
  ConflictError,
  InternalError,
  NotFoundError,
} from "@decaf-ts/db-decorators";
import "reflect-metadata";
import { metadata } from "@decaf-ts/reflection";

export class CouchDBAdapter extends Adapter<DocumentScope<any>, MangoQuery> {
  constructor(scope: DocumentScope<any>, flavour: string) {
    super(scope, flavour);
  }

  getSequence<V>(
    model: V,
    sequence: Constructor<Sequence>,
    options: SequenceOptions | undefined,
  ): Promise<Sequence> {
    console.log(model, sequence, options);
    return Promise.resolve(undefined as unknown as Sequence);
  }

  createIndex(...args: any[]): Promise<any> {
    return Promise.resolve(args);
  }

  async raw<V>(rawInput: MangoQuery): Promise<V> {
    const response: MangoResponse<V> = await this.native.find(rawInput);
    return response.docs as V;
  }

  async create(
    tableName: string,
    id: string | number,
    model: Record<string, any>,
  ): Promise<Record<string, any>> {
    const record: Record<string, any> = {};
    record[CouchDBKeys.TABLE] = tableName;
    record[CouchDBKeys.ID] = this.generateId(tableName, id);
    Object.assign(record, model);
    let response: DocumentInsertResponse;
    try {
      response = await this.native.insert(record);
    } catch (e: any) {
      throw this.parseError(e);
    }

    if (!response.ok)
      throw new InternalError(
        `Failed to insert doc id: ${id} in table ${tableName}`,
      );
    metadata(
      getPersistenceKey(PersistenceKeys.METADATA),
      response.rev,
    )(model.constructor);
    return model;
  }

  async read(
    tableName: string,
    id: string | number,
  ): Promise<Record<string, any>> {
    const _id = this.generateId(tableName, id);
    let record: DocumentGetResponse;
    try {
      record = await this.native.get(_id);
    } catch (e: any) {
      throw this.parseError(e);
    }
    metadata(
      getPersistenceKey(PersistenceKeys.METADATA),
      record._rev,
    )(record.constructor);
    return record;
  }

  async update(
    tableName: string,
    id: string | number,
    model: Record<string, any>,
  ): Promise<Record<string, any>> {
    const record: Record<string, any> = {};
    record[CouchDBKeys.TABLE] = tableName;
    record[CouchDBKeys.ID] = this.generateId(tableName, id);
    const rev = Reflect.getMetadata(
      getPersistenceKey(PersistenceKeys.METADATA),
      model,
    );
    if (!rev)
      throw new InternalError(
        `No revision number found for record with id ${id}`,
      );
    Object.assign(record, model);
    let response: DocumentInsertResponse;
    try {
      response = await this.native.insert(record, { rev: rev });
    } catch (e: any) {
      throw this.parseError(e);
    }

    if (!response.ok)
      throw new InternalError(
        `Failed to update doc id: ${id} in table ${tableName}`,
      );
    metadata(
      getPersistenceKey(PersistenceKeys.METADATA),
      response.rev,
    )(model.constructor);
    return model;
  }

  async delete(
    tableName: string,
    id: string | number,
  ): Promise<Record<string, any>> {
    const _id = this.generateId(tableName, id);
    let record: DocumentGetResponse;
    try {
      record = await this.native.get(_id);
      await this.native.destroy(_id, record._rev);
    } catch (e: any) {
      throw this.parseError(e);
    }
    metadata(
      getPersistenceKey(PersistenceKeys.METADATA),
      record._rev,
    )(record.constructor);
    return record;
  }

  private generateId(tableName: string, id: string | number) {
    return [tableName, id].join(CouchDBKeys.SEPARATOR);
  }

  protected parseError(err: Error | string, reason?: string): BaseError {
    return CouchDBAdapter.parseError(err, reason);
  }

  protected isReserved(attr: string): boolean {
    return !!attr.match(reservedAttributes);
  }

  protected static parseError(err: Error | string, reason?: string): BaseError {
    if (err instanceof BaseError) return err as any;
    const code =
      typeof err === "string"
        ? err
        : (err as any).code
          ? (err as any).code
          : err.message;

    if (code.match(/already exist|update conflict/g))
      return new ConflictError(code);
    if (code.match(/missing/g)) return new NotFoundError(code);

    switch (code) {
      case "401":
        return new ConflictError(`${code}${reason ? ` - ${reason}` : ""}`);
      default:
        return new InternalError(err);
    }
  }

  static connect(
    user: string,
    pass: string,
    host = "localhost:5984",
    protocol: "http" | "https" = "http",
  ): ServerScope {
    return Nano(`${protocol}://${user}:${pass}@${host}`);
  }

  static async createDatabase(con: ServerScope, name: string) {
    let result: DatabaseCreateResponse;
    try {
      result = await con.db.create(name);
    } catch (e: any) {
      throw this.parseError(e);
    }
    const { ok, error, reason } = result;
    if (!ok) throw this.parseError(error as string, reason);
  }

  static async deleteDatabase(con: ServerScope, name: string) {
    let result;
    try {
      result = await con.db.destroy(name);
    } catch (e: any) {
      throw this.parseError(e);
    }
    const { ok } = result;
    if (!ok)
      throw new InternalError(`Failed to delete database with name ${name}`);
  }

  static async createUser(
    con: ServerScope,
    dbName: string,
    user: string,
    pass: string,
    roles: string[] = [],
  ) {
    const users = await con.db.use("_users");
    const usr = {
      _id: "org.couchdb.user:" + user,
      name: user,
      password: pass,
      roles: roles,
      type: "user",
    };
    try {
      const created: DocumentInsertResponse = await users.insert(
        usr as MaybeDocument,
      );
      const { ok } = created;
      if (!ok) throw new InternalError(`Failed to create user ${user}`);
      const security: any = await con.request({
        db: dbName,
        method: "put",
        path: "_security",
        // headers: {
        //
        // },
        body: {
          admins: {
            names: [],
            roles: [],
          },
          members: {
            names: [user],
            roles: roles,
          },
        },
      });
      if (!security.ok)
        throw new InternalError(
          `Failed to authorize user ${user} to db ${dbName}`,
        );
    } catch (e: any) {
      throw this.parseError(e);
    }
  }
}
