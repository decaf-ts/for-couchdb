import {
  ClauseFactory,
  Condition,
  FromClause,
  FromSelector,
  GroupBySelector,
  LimitSelector,
  OffsetSelector,
  OrderBySelector,
  QueryError,
  SelectSelector,
  Statement,
} from "@decaf-ts/core";
import { LimitClause } from "@decaf-ts/core";
import { SelectClause } from "@decaf-ts/core";
import { WhereClause } from "@decaf-ts/core";
import { OffsetClause } from "@decaf-ts/core";
import { OrderByClause } from "@decaf-ts/core";
import { GroupByClause } from "@decaf-ts/core";
import { ValuesClause } from "@decaf-ts/core";
import { InsertClause } from "@decaf-ts/core";
import { CouchDBFromClause } from "./FromClause";
import { ModelArg, Model } from "@decaf-ts/decorator-validation";
import { InternalError } from "@decaf-ts/db-decorators";
import { CouchDBInsertClause } from "./InsertClause";
import { CouchDBStatement } from "./Statement";
import { CouchDBWhereClause } from "./WhereClause";
import { CouchDBSelectClause } from "./SelectClause";
import { CouchDBValuesClause } from "./ValuesClause";
import { CouchDBOperator } from "./constants";
import { CouchDBAdapter } from "../adapter";
import { DocumentScope, MangoQuery, MangoSelector } from "../types";

export class Factory extends ClauseFactory<DocumentScope<any>, MangoQuery> {
  constructor(adapter: CouchDBAdapter) {
    super(adapter);
  }

  from<M extends Model>(
    statement: Statement<MangoQuery>,
    selector: FromSelector<M>
  ): FromClause<MangoQuery, M> {
    return new CouchDBFromClause({ statement: statement, selector: selector });
  }

  groupBy(
    statement: Statement<MangoQuery>,
    selector: GroupBySelector
  ): GroupByClause<MangoQuery> {
    return new (class extends GroupByClause<MangoQuery> {
      constructor(clause: ModelArg<GroupByClause<MangoQuery>>) {
        super(clause);
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      build(query: MangoQuery): MangoQuery {
        throw new InternalError("Not implemented");
      }
    })({
      statement: statement,
      selector: selector,
    });
  }

  insert<M extends Model>(): InsertClause<MangoQuery, M> {
    return new CouchDBInsertClause({
      statement: new CouchDBStatement(this.adapter as CouchDBAdapter),
    });
  }

  limit(
    statement: Statement<MangoQuery>,
    selector: LimitSelector
  ): LimitClause<MangoQuery> {
    return new (class extends LimitClause<MangoQuery> {
      constructor(clause: ModelArg<LimitClause<MangoQuery>>) {
        super(clause);
      }

      build(query: MangoQuery): MangoQuery {
        query.limit = this.selector as number;
        return query;
      }
    })({
      statement: statement,
      selector: selector,
    });
  }

  offset(
    statement: Statement<MangoQuery>,
    selector: OffsetSelector
  ): OffsetClause<MangoQuery> {
    return new (class extends OffsetClause<MangoQuery> {
      constructor(clause: ModelArg<OffsetClause<MangoQuery>>) {
        super(clause);
      }

      build(query: MangoQuery): MangoQuery {
        const skip: number = parseInt(this.selector as unknown as string);
        if (isNaN(skip)) throw new QueryError("Failed to parse offset");
        query.skip = skip;
        return query;
      }
    })({
      statement: statement,
      selector: selector,
    });
  }

  orderBy(
    statement: Statement<MangoQuery>,
    selector: OrderBySelector[]
  ): OrderByClause<MangoQuery> {
    return new (class extends OrderByClause<MangoQuery> {
      constructor(clause: ModelArg<OrderByClause<MangoQuery>>) {
        super(clause);
      }

      build(query: MangoQuery): MangoQuery {
        query.sort = query.sort || [];
        query.selector = query.selector || ({} as MangoSelector);
        this.selector!.forEach((s) => {
          const [selector, value] = s;
          const rec: any = {};
          rec[selector] = value;
          (query.sort as any[]).push(rec as any);
          if (!query.selector[selector]) {
            query.selector[selector] = {} as MangoSelector;
            (query.selector[selector] as MangoSelector)[
              CouchDBOperator.BIGGER
            ] = null;
          }
          // query.fields = query.fields || [];
          // query.fields = [...new Set([...query.fields, selector]).keys()]
        });
        return query;
      }
    })({
      statement: statement,
      selector: selector,
    });
  }

  select<M extends Model>(
    selector: SelectSelector | undefined
  ): SelectClause<MangoQuery, M> {
    return new CouchDBSelectClause({
      statement: new CouchDBStatement(this.adapter),
      selector: selector,
    });
  }

  values<M extends Model>(
    statement: Statement<MangoQuery>,
    values: M[]
  ): ValuesClause<MangoQuery, M> {
    return new CouchDBValuesClause<M>({
      statement: statement,
      values: values,
    });
  }

  where(
    statement: Statement<MangoQuery>,
    condition: Condition
  ): WhereClause<MangoQuery> {
    return new CouchDBWhereClause({
      statement: statement,
      condition: condition,
    });
  }
}
