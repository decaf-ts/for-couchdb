/* eslint-disable @typescript-eslint/no-unused-vars */
import { CouchDBAdapter } from "../../src/adapter";
import { CouchDBKeys } from "../../src/constants";
import { Context } from "@decaf-ts/core";
import type { MangoQuery } from "../../src/types";
import type { Constructor } from "@decaf-ts/decoration";
import type { Model } from "@decaf-ts/decorator-validation";

class TestAdapter extends CouchDBAdapter<any, any, Context<any>> {
  constructor() {
    super({}, "test-couchdb");
  }

  protected async index<M extends Model>(..._models: Constructor<M>[]) {
    return;
  }

  async raw<R, D extends boolean>(
    _rawInput: MangoQuery,
    _docsOnly: D,
    ..._args: any[]
  ): Promise<any> {
    throw new Error("not implemented");
  }

  async view<R>(
    _ddoc: string,
    _view: string,
    _options: Record<string, any>,
    ..._args: any[]
  ): Promise<any> {
    throw new Error("not implemented");
  }

  async create<M extends Model>(
    _clazz: Constructor<M>,
    _id: any,
    _model: Record<string, any>,
    ..._args: any[]
  ): Promise<Record<string, any>> {
    throw new Error("not implemented");
  }

  async read<M extends Model>(
    _clazz: Constructor<M>,
    _id: any,
    ..._args: any[]
  ): Promise<Record<string, any>> {
    throw new Error("not implemented");
  }

  async update<M extends Model>(
    _clazz: Constructor<M>,
    _id: any,
    _model: Record<string, any>,
    ..._args: any[]
  ): Promise<Record<string, any>> {
    throw new Error("not implemented");
  }

  async delete<M extends Model>(
    _clazz: Constructor<M>,
    _id: any,
    ..._args: any[]
  ): Promise<Record<string, any>> {
    throw new Error("not implemented");
  }

  gen(tableName: string, id: string | number) {
    return this.generateId(tableName, id as any);
  }
}

describe("CouchDBAdapter.generateId", () => {
  const a = new TestAdapter();

  it("prefixes raw ids with `${table}__${id}`", () => {
    expect(a.gen("t", "123")).toBe(`t${CouchDBKeys.SEPARATOR}123`);
  });

  it("does not double-prefix an already qualified id", () => {
    const qualified = `t${CouchDBKeys.SEPARATOR}123`;
    expect(a.gen("t", qualified)).toBe(qualified);
  });

  it("still prefixes when the qualified id is for a different table", () => {
    const other = `other${CouchDBKeys.SEPARATOR}123`;
    expect(a.gen("t", other)).toBe(`t${CouchDBKeys.SEPARATOR}${other}`);
  });

  it("supports sequence table ids (no double prefix)", () => {
    const seqId = `owner_1_version`;
    const qualified = `${CouchDBKeys.SEQUENCE}${CouchDBKeys.SEPARATOR}${seqId}`;
    expect(a.gen(CouchDBKeys.SEQUENCE, qualified)).toBe(qualified);
  });
});
