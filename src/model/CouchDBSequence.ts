import type { ModelArg } from "@decaf-ts/decorator-validation";
import { model, required } from "@decaf-ts/decorator-validation";
import { BaseModel, pk, index, table } from "@decaf-ts/core";
import { CouchDBKeys } from "../constants";

@table(CouchDBKeys.SEQUENCE)
@model()
export class Sequence extends BaseModel {
  @pk()
  id!: string;
  @required()
  @index()
  current!: string | number;

  constructor(seq?: ModelArg<Sequence>) {
    super(seq);
  }
}
