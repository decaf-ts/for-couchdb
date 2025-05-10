import { BaseError } from "@decaf-ts/db-decorators";

export class IndexError extends BaseError {
  constructor(msg: string | Error) {
    super(IndexError.name, msg, 500);
  }
}
