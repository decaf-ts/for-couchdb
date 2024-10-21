import { Repository } from "@decaf-ts/core";
import { MangoQuery } from "nano";
import { CouchDBAdapter } from "../adapter";
import { Model } from "@decaf-ts/decorator-validation";

export interface CouchDBRepository<M extends Model>
  extends Repository<M, MangoQuery> {
  adapter: CouchDBAdapter;
}
