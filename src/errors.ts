import { BaseError } from "@decaf-ts/db-decorators";

/**
 * @description Error thrown when there is an issue with CouchDB indexes
 * @summary Represents an error related to CouchDB index operations
 * @param {string|Error} msg - The error message or Error object
 * @class
 * @category Errors
 * @example
 * // Example of using IndexError
 * try {
 *   // Some code that might throw an index error
 *   throw new IndexError("Index not found");
 * } catch (error) {
 *   if (error instanceof IndexError) {
 *     console.error("Index error occurred:", error.message);
 *   }
 * }
 */
export class IndexError extends BaseError {
  constructor(msg: string | Error) {
    super(IndexError.name, msg, 404);
  }
}
