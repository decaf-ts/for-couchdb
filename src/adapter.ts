import { Adapter, Sequence, SequenceOptions } from "@decaf-ts/core";
import { Constructor } from "@decaf-ts/decorator-validation";

export class CouchDBAdapter extends Adapter {
  getSequence<V>(
    model: V,
    sequence: Constructor<Sequence>,
    options: SequenceOptions | undefined,
  ): Promise<Sequence> {
    return Promise.resolve(undefined);
  }
  createIndex(args: any): Promise<any> {
    return Promise.resolve(undefined);
  }

  create<V>(model: V, args: any): Promise<V> {
    return Promise.resolve(undefined);
  }

  delete<V>(key: string | number, args: any): Promise<V> {
    return Promise.resolve(undefined);
  }

  raw<V>(rawInput: string, args: any): Promise<V> {
    return Promise.resolve(undefined);
  }

  read<V>(key: string | number, args: any): Promise<V> {
    return Promise.resolve(undefined);
  }

  update<V>(model: V, args: any): Promise<V> {
    return Promise.resolve(undefined);
  }

  create(model: any, ...args: any[]): Promise<any> {
    return Promise.resolve(undefined);
  }

  delete(key: string, ...args: any[]): Promise<any> {
    return Promise.resolve(undefined);
  }

  raw<V>(rawInput: string, ...args: any[]): Promise<V> {
    return Promise.resolve(undefined);
  }

  read(key: string, ...args: any[]): Promise<any> {
    return Promise.resolve(undefined);
  }

  update(model: any, ...args: any[]): Promise<any> {
    return Promise.resolve(undefined);
  }
}
