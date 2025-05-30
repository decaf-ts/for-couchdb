import { Repository } from "@decaf-ts/core";
import { CouchDBAdapter } from "../adapter";
import { Model } from "@decaf-ts/decorator-validation";
import { MangoQuery } from "../types";
import { Context, RepositoryFlags } from "@decaf-ts/db-decorators";

/**
 * @description Repository type for CouchDB operations
 * @summary Type definition for a repository that works with CouchDB through the CouchDBAdapter
 * @template M - The model type that extends Model
 * @template Y - The scope type
 * @template F - The repository flags type
 * @template C - The context type that extends Context<F>
 * @typedef {Repository<M, MangoQuery, CouchDBAdapter<Y, F, C>>} CouchDBRepository
 * @memberOf module:for-couchdb
 */
export type CouchDBRepository<
  M extends Model,
  Y,
  F extends RepositoryFlags,
  C extends Context<F>,
> = Repository<M, MangoQuery, CouchDBAdapter<Y, F, C>>;
