import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { BaseModel, pk, index } from "@decaf-ts/core";

@model()
export class Sequence extends BaseModel {
  /**
   * @summary the Primary key for the DBSequence
   * @prop name
   *
   * @see pk
   */
  @pk()
  name?: string = undefined;
  /**
   * @summary the current value for the DBSequence
   * @prop current
   *
   * @see required
   * @see index
   */
  @required()
  @index()
  current?: string | number = "0";

  constructor(seq?: ModelArg<Sequence>) {
    super(seq as any);
  }
}
