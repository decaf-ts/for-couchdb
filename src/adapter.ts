import {
  Adapter,
  Sequence,
  SequenceOptions,
  PersistenceKeys,
  Operator,
  GroupOperator,
  Statement,
  Query,
  ClauseFactory,
  Condition,
} from "@decaf-ts/core";
import {
  MangoQuery,
  DocumentScope,
  DocumentInsertResponse,
  DocumentGetResponse,
  ServerScope,
  DatabaseCreateResponse,
  MaybeDocument,
  MangoResponse,
  MangoSelector,
} from "nano";
import * as Nano from "nano";
import { CouchDBKeys, reservedAttributes } from "./constants";
import {
  BaseError,
  ConflictError,
  DBModel,
  InternalError,
  NotFoundError,
} from "@decaf-ts/db-decorators";
import "reflect-metadata";
import { CouchDBStatement } from "./query/Statement";
import { Factory } from "./query";
import { translateOperators } from "./query/translate";
import { CouchDBSequence } from "./sequences/Sequence";

export class CouchDBAdapter extends Adapter<DocumentScope<any>, MangoQuery> {
  private factory?: Factory;

  constructor(scope: DocumentScope<any>, flavour: string) {
    super(scope, flavour);
  }

  get Clauses(): ClauseFactory<DocumentScope<any>, MangoQuery> {
    if (!this.factory) this.factory = new Factory(this);
    return this.factory;
  }

  Query<M extends DBModel>(): Query<MangoQuery, M> {
    return super.Query();
  }

  get Statement(): Statement<MangoQuery> {
    return new CouchDBStatement(this);
  }

  parseCondition(condition: Condition): MangoQuery {
    function merge(
      op: GroupOperator,
      obj1: MangoSelector,
      obj2: MangoSelector,
    ): MangoQuery {
      const result: MangoQuery = { selector: {} as MangoSelector };
      result.selector[op] = [obj1, obj2];
      return result;
    }

    const { attr1, operator, comparison } = condition as unknown as {
      attr1: string | Condition;
      operator: Operator | GroupOperator;
      comparison: any;
    };

    let op: MangoSelector = {} as MangoSelector;
    if (
      [GroupOperator.AND, GroupOperator.OR, Operator.NOT].indexOf(
        operator as GroupOperator,
      ) === -1
    ) {
      op[attr1 as string] = {} as MangoSelector;
      (op[attr1 as string] as MangoSelector)[translateOperators(operator)] =
        comparison;
    } else if (operator === Operator.NOT) {
      op = this.parseCondition(attr1 as Condition).selector as MangoSelector;
      op[translateOperators(Operator.NOT)] = {} as MangoSelector;
      (op[translateOperators(Operator.NOT)] as MangoSelector)[
        (attr1 as unknown as { attr1: string }).attr1
      ] = comparison;
    } else {
      const op1: any = this.parseCondition(attr1 as Condition).selector;
      const op2: any = this.parseCondition(comparison as Condition).selector;
      op = merge(operator as GroupOperator, op1, op2).selector;
    }

    return { selector: op };
  }

  async Sequence(options: SequenceOptions): Promise<Sequence> {
    return new CouchDBSequence(options);
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
    Object.defineProperty(model, PersistenceKeys.METADATA, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: response.rev,
    });
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
    Object.defineProperty(record, PersistenceKeys.METADATA, {
      enumerable: false,
      writable: false,
      value: record._rev,
    });
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
    const rev = model[PersistenceKeys.METADATA];
    if (!rev)
      throw new InternalError(
        `No revision number found for record with id ${id}`,
      );
    Object.assign(record, model);
    record[CouchDBKeys.REV] = rev;
    let response: DocumentInsertResponse;
    try {
      response = await this.native.insert(record);
    } catch (e: any) {
      throw this.parseError(e);
    }

    if (!response.ok)
      throw new InternalError(
        `Failed to update doc id: ${id} in table ${tableName}`,
      );
    Object.defineProperty(model, PersistenceKeys.METADATA, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: response.rev,
    });
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
    Object.defineProperty(record, PersistenceKeys.METADATA, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: record._rev,
    });
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
    }

    switch (code.toString()) {
      case "401":
      case "412":
      case "409":
        return new ConflictError(reason as string);
      case "404":
        return new NotFoundError(reason as string);
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

  static async deleteUser(con: ServerScope, dbName: string, user: string) {
    const users = await con.db.use("_users");
    const id = "org.couchdb.user:" + user;
    try {
      const usr = await users.get(id);
      await users.destroy(id, usr._rev);
    } catch (e: any) {
      throw this.parseError(e);
    }
  }
}
