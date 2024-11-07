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
  ConnectionError,
  Repository,
  User,
} from "@decaf-ts/core";
import { CouchDBKeys, reservedAttributes } from "./constants";
import {
  BaseError,
  ConflictError,
  InternalError,
  NotFoundError,
} from "@decaf-ts/db-decorators";
import "reflect-metadata";
import { CouchDBStatement } from "./query/Statement";
import { Factory } from "./query";
import { translateOperators } from "./query/translate";
import { CouchDBSequence } from "./sequences/Sequence";
import { Constructor, Model } from "@decaf-ts/decorator-validation";
import { IndexError } from "./errors";
import { generateIndexes } from "./indexes/generator";
import {
  CreateIndexRequest,
  DocumentBulkResponse,
  DocumentGetResponse,
  DocumentInsertResponse,
  DocumentScope,
  MangoOperator,
  MangoQuery,
  MangoResponse,
  MangoSelector,
} from "./types";

export abstract class CouchDBAdapter extends Adapter<
  DocumentScope<any>,
  MangoQuery
> {
  protected factory?: Factory;

  protected constructor(scope: DocumentScope<any>, flavour: string) {
    super(scope, flavour);
  }

  get Clauses(): ClauseFactory<DocumentScope<any>, MangoQuery> {
    if (!this.factory) this.factory = new Factory(this);
    return this.factory;
  }

  Query<M extends Model>(): Query<MangoQuery, M> {
    return super.Query();
  }

  get Statement(): Statement<MangoQuery> {
    return new CouchDBStatement(this);
  }

  parseCondition(condition: Condition): MangoQuery {
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
      attr1: string | Condition;
      operator: Operator | GroupOperator;
      comparison: any;
    };

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
      op = this.parseCondition(attr1 as Condition).selector as MangoSelector;
      op[translateOperators(Operator.NOT)] = {} as MangoSelector;
      (op[translateOperators(Operator.NOT)] as MangoSelector)[
        (attr1 as unknown as { attr1: string }).attr1
      ] = comparison;
    } else {
      const op1: any = this.parseCondition(attr1 as Condition).selector;
      const op2: any = this.parseCondition(comparison as Condition).selector;
      op = merge(translateOperators(operator), op1, op2).selector;
    }

    return { selector: op };
  }

  async Sequence(options: SequenceOptions): Promise<Sequence> {
    return new CouchDBSequence(options, this);
  }

  async initialize(): Promise<void> {
    const managedModels = Adapter.models(this.flavour);
    return this.index(...managedModels);
  }

  async index<M extends Model>(...models: Constructor<M>[]): Promise<void> {
    const indexes: CreateIndexRequest[] = generateIndexes(models);
    for (const index of indexes) {
      const res = await this.native.createIndex(index);
      const { result, id, name } = res;
      if (result === "existing")
        throw new ConflictError(`Index for table ${name} with id ${id}`);
    }
  }

  abstract user(): Promise<User>;

  async raw<V>(rawInput: MangoQuery, process = true): Promise<V> {
    try {
      const response: MangoResponse<V> = await this.native.find(rawInput);
      if (process) return response.docs as V;
      return response as V;
    } catch (e: any) {
      throw this.parseError(e);
    }
  }

  async create(
    tableName: string,
    id: string | number,
    model: Record<string, any>
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
        `Failed to insert doc id: ${id} in table ${tableName}`
      );
    Object.defineProperty(model, PersistenceKeys.METADATA, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: response.rev,
    });
    return model;
  }

  async createAll(
    tableName: string,
    ids: string[] | number[],
    models: Record<string, any>[]
  ): Promise<Record<string, any>[]> {
    if (ids.length !== models.length)
      throw new InternalError("Ids and models must have the same length");

    const records = ids.map((id, count) => {
      const record: Record<string, any> = {};
      record[CouchDBKeys.TABLE] = tableName;
      record[CouchDBKeys.ID] = this.generateId(tableName, id);
      Object.assign(record, models[count]);
      return record;
    });
    let response: DocumentBulkResponse[];
    try {
      response = await this.native.bulk({ docs: records });
    } catch (e: any) {
      throw this.parseError(e);
    }
    if (!response.every((r) => !r.error)) {
      const errors = response.reduce((accum: string[], el, i) => {
        if (el.error)
          accum.push(
            `el ${i}: ${el.error}${el.reason ? ` - ${el.reason}` : ""}`
          );
        return accum;
      }, []);
      throw new InternalError(errors.join("\n"));
    }

    models.forEach((m, i) => {
      Repository.setMetadata(m as any, response[i].rev);
      return m;
    });
    return models;
  }

  async read(
    tableName: string,
    id: string | number
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

  abstract readAll(
    tableName: string,
    ids: (string | number | bigint)[]
  ): Promise<Record<string, any>[]>;

  async update(
    tableName: string,
    id: string | number,
    model: Record<string, any>
  ): Promise<Record<string, any>> {
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
    let response: DocumentInsertResponse;
    try {
      response = await this.native.insert(record);
    } catch (e: any) {
      throw this.parseError(e);
    }

    if (!response.ok)
      throw new InternalError(
        `Failed to update doc id: ${id} in table ${tableName}`
      );
    Object.defineProperty(model, PersistenceKeys.METADATA, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: response.rev,
    });
    return model;
  }

  async updateAll(
    tableName: string,
    ids: string[] | number[],
    models: Record<string, any>[]
  ): Promise<Record<string, any>[]> {
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
    let response: DocumentBulkResponse[];
    try {
      response = await this.native.bulk({ docs: records });
    } catch (e: any) {
      throw this.parseError(e);
    }
    if (!response.every((r) => !r.error)) {
      const errors = response.reduce((accum: string[], el, i) => {
        if (el.error)
          accum.push(
            `el ${i}: ${el.error}${el.reason ? ` - ${el.reason}` : ""}`
          );
        return accum;
      }, []);
      throw new InternalError(errors.join("\n"));
    }

    models.forEach((m, i) => {
      Repository.setMetadata(m as any, response[i].rev);
      return m;
    });
    return models;
  }

  async delete(
    tableName: string,
    id: string | number
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

  abstract deleteAll(
    tableName: string,
    ids: (string | number | bigint)[]
  ): Promise<Record<string, any>[]>;

  protected generateId(tableName: string, id: string | number) {
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
