import { Repository } from "@decaf-ts/core";
import { CouchDBAdapter } from "../adapter";
import { Model } from "@decaf-ts/decorator-validation";
import { MangoQuery } from "../types";

export interface CouchDBRepository<M extends Model>
  extends Repository<M, MangoQuery> {
  adapter: CouchDBAdapter;
}
