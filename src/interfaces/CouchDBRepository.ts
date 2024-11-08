import { Repository } from "@decaf-ts/core";
import { CouchDBAdapter } from "../adapter";
import { Model } from "@decaf-ts/decorator-validation";
import { MangoQuery } from "../types";

export type CouchDBRepository<M extends Model, S> = Repository<
  M,
  MangoQuery,
  CouchDBAdapter<S>
>;
