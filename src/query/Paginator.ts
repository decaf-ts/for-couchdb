import { Paginator, PagingError, Sequence } from "@decaf-ts/core";
import {
  DefaultSeparator,
  findPrimaryKey,
  InternalError,
} from "@decaf-ts/db-decorators";
import { MangoQuery, MangoResponse } from "../types";
import { Constructor, Model } from "@decaf-ts/decorator-validation";
import { CouchDBAdapter } from "../adapter";

export class CouchDBPaginator<M extends Model, R> extends Paginator<
  M,
  R,
  MangoQuery
> {
  private bookMark?: string;

  override get total(): number {
    throw new InternalError(`The total pages api is not available for couchdb`);
  }

  override get count(): number {
    throw new InternalError(
      `The record count api is not available for couchdb`
    );
  }

  constructor(
    adapter: CouchDBAdapter<any, any, any>,
    query: MangoQuery,
    size: number,
    clazz: Constructor<M>
  ) {
    super(adapter, query, size, clazz);
  }

  protected prepare(rawStatement: MangoQuery): MangoQuery {
    const query: MangoQuery = Object.assign({}, rawStatement);
    if (query.limit) this.limit = query.limit;

    query.limit = this.size;

    return query;
  }

  async page(page: number = 1): Promise<R[]> {
    const statement = Object.assign({}, this.statement);

    // if (!this._recordCount || !this._totalPages) {
    //   // this._recordCount = await this.adapter
    //   //   .Query()
    //   //   .count()
    //   //   .from(target)
    //   //   .execute<number>();
    // }
    this.validatePage(page);

    if (page !== 1) {
      if (!this.bookMark)
        throw new PagingError("No bookmark. Did you start in the first page?");
      statement["bookmark"] = this.bookMark;
    }
    const rawResult: MangoResponse<any> = await this.adapter.raw(
      statement,
      false
    );

    const { docs, bookmark, warning } = rawResult;
    if (warning) console.warn(warning);
    if (!this.clazz) throw new PagingError("No statement target defined");
    const pkDef = findPrimaryKey(new this.clazz());
    const results =
      statement.fields && statement.fields.length
        ? docs // has fields means its not full model
        : docs.map((d: any) => {
            //no fields means we need to revert to saving process
            const originalId = d._id.split(DefaultSeparator);
            originalId.splice(0, 1); // remove the table name
            return this.adapter.revert(
              d,
              this.clazz,
              pkDef.id,
              Sequence.parseValue(
                pkDef.props.type,
                originalId.join(DefaultSeparator)
              )
            );
          });
    this.bookMark = bookmark;
    this._currentPage = page;
    return results;
  }
}
