import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { BaseModel, pk, index, table } from "@decaf-ts/core";
import { CouchDBKeys } from "../constants";

@table(CouchDBKeys.SEQUENCE)
@model()
export class Sequence extends BaseModel {
  /**
   * @summary the Primary key for the DBSequence
   * @prop name
   *
   * @see pk
   */
  @pk()
  id?: string = undefined;
  /**
   * @summary the current value for the DBSequence
   * @prop current
   *
   * @see required
   * @see index
   */
  @required()
  @index()
  current?: string | number = undefined;

  constructor(seq?: ModelArg<Sequence>) {
    super(seq);
  }
}
