import { Repository } from "@decaf-ts/core";
import { CouchDBAdapter } from "../adapter";
import { Model } from "@decaf-ts/decorator-validation";
import { MangoQuery } from "../types";
import { Context, RepositoryFlags } from "@decaf-ts/db-decorators";

export type CouchDBRepository<
  M extends Model,
  Y,
  F extends RepositoryFlags,
  C extends Context<F>,
> = Repository<M, MangoQuery, CouchDBAdapter<Y, F, C>>;
