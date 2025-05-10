import { Context, Repository } from "@decaf-ts/core";
import { CouchDBAdapter } from "../adapter";
import { Model } from "@decaf-ts/decorator-validation";
import { RepositoryFlags } from "@decaf-ts/db-decorators";
import { MangoQuery } from "../types";

export type CouchDBRepository<
  M extends Model,
  C extends Context<F>,
  F extends RepositoryFlags,
> = Repository<M, C, F, MangoQuery, CouchDBAdapter<any, C, F>>;
