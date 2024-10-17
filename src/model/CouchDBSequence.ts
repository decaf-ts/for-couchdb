import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { BaseModel, pk, index, table, uses } from "@decaf-ts/core";

@table("??sequence")
@uses("nano")
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