import type { ModelArg } from "@decaf-ts/decorator-validation";
import { model, required } from "@decaf-ts/decorator-validation";
import { BaseModel, pk, index, table } from "@decaf-ts/core";
import { CouchDBKeys } from "../constants";

/**
 * @description Model for CouchDB sequence records
 * @summary Represents a sequence in CouchDB used for generating sequential IDs
 * @param {ModelArg<Sequence>} [seq] - Optional initialization data for the sequence
 * @class
 * @example
 * // Example of creating and using a Sequence
 * const sequence = new Sequence({ id: 'user-seq', current: 1 });
 * // Increment the sequence
 * sequence.current = Number(sequence.current) + 1;
 */
@table(CouchDBKeys.SEQUENCE)
@model()
export class Sequence extends BaseModel {
  /**
   * @description The unique identifier for the sequence
   * @summary Primary key for the sequence record
   */
  @pk()
  id!: string;

  /**
   * @description The current value of the sequence
   * @summary Current sequence value that can be incremented
   */
  @required()
  @index()
  current!: string | number;

  constructor(seq?: ModelArg<Sequence>) {
    super(seq);
  }
}
