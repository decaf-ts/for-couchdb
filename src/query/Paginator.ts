import {
  Paginator,
  PagingError,
  SequenceOptions,
  Statement,
} from "@decaf-ts/core";
import {
  DefaultSeparator,
  findPrimaryKey,
  InternalError,
} from "@decaf-ts/db-decorators";
import { parseSequenceValue } from "../sequences/utils";
import { MangoQuery, MangoResponse } from "../types";

export class CouchDBPaginator<V> extends Paginator<V, MangoQuery> {
  private bookMark?: string;

  get total(): number {
    throw new InternalError(`The total pages api is not available for couchdb`);
  }

  get count(): number {
    throw new InternalError(
      `The record count api is not available for couchdb`
    );
  }

  constructor(
    statement: Statement<MangoQuery>,
    size: number,
    rawStatement: MangoQuery
  ) {
    super(statement, size, rawStatement);
  }

  protected prepare(rawStatement: MangoQuery): MangoQuery {
    const query: MangoQuery = Object.assign({}, rawStatement);
    if (query.limit) this.limit = query.limit;

    query.limit = this.size;

    return query;
  }

  async page(page: number = 1, ...args: any[]): Promise<V[]> {
    const statement = Object.assign({}, this.statement);
    const target = this.stat.getTarget();
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
      false,
      ...args
    );

    const { docs, bookmark, warning } = rawResult;
    if (warning) console.warn(warning);
    if (!target) throw new PagingError("No statement target defined");
    const pkDef = findPrimaryKey(new target()) as {
      id: string;
      props: SequenceOptions;
    };
    const results =
      statement.fields && statement.fields.length
        ? docs // has fields means its not full model
        : docs.map((d: any) => {
            //no fields means we need to revert to saving process
            if (!target) throw new PagingError("No statement target defined");
            const pk = pkDef.id;
            const originalId = d._id.split(DefaultSeparator);
            originalId.splice(0, 1); // remove the table name
            return this.adapter.revert(
              d,
              target,
              pk,
              parseSequenceValue(
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
