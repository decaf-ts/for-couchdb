import { DBModel } from "@decaf-ts/db-decorators";
import { Repository } from "@decaf-ts/core";
import { MangoQuery } from "nano";
import { CouchDBAdapter } from "../adapter";

export interface CouchDBRepository<M extends DBModel>
  extends Repository<M, MangoQuery> {
  adapter: CouchDBAdapter;
}
