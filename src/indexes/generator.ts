import {
  IndexMetadata,
  OrderDirection,
  PersistenceKeys,
  Repository,
} from "@decaf-ts/core";
import { CouchDBKeys } from "../constants";
import { DefaultSeparator } from "@decaf-ts/db-decorators";
import { Constructor, Model } from "@decaf-ts/decorator-validation";
import { CouchDBOperator } from "../query/constants";
import { CreateIndexRequest } from "../types";

function generateIndexName(
  name: string[],
  direction?: OrderDirection,
  compositions?: string[],
  separator = DefaultSeparator
) {
  return [
    ...name.map((n) => (n === CouchDBKeys.TABLE ? "table" : n)),
    ...(compositions || []),
    ...(direction ? [direction] : []),
    CouchDBKeys.INDEX,
  ].join(separator);
}

export function generateIndexes<M extends Model>(
  models: Constructor<M>[]
): CreateIndexRequest[] {
  const tableName = generateIndexName([CouchDBKeys.TABLE]);
  const indexes: Record<string, CreateIndexRequest> = {};
  indexes[tableName] = {
    index: {
      fields: [CouchDBKeys.TABLE],
    },
    name: tableName,
    ddoc: tableName,
    type: "json",
  };

  models.forEach((m) => {
    const ind: Record<string, IndexMetadata> = Repository.indexes(m);
    Object.entries(ind).forEach(([key, value]) => {
      const k = Object.keys(value)[0];
      // eslint-disable-next-line prefer-const
      let { directions, compositions } = (value as any)[k];
      const tableName = Repository.table(m);
      compositions = compositions || [];

      function generate(sort?: OrderDirection) {
        const name = [
          tableName,
          key,
          ...(compositions as []),
          PersistenceKeys.INDEX,
        ].join(DefaultSeparator);

        indexes[name] = {
          index: {
            fields: [key, ...(compositions as []), CouchDBKeys.TABLE].reduce(
              (accum: any[], el) => {
                if (sort) {
                  const res: any = {};
                  res[el] = sort;
                  accum.push(res);
                } else {
                  accum.push(el);
                }
                return accum;
              },
              []
            ),
          },
          name: name,
          ddoc: name,
          type: "json",
        };
        if (!sort) {
          const tableFilter: Record<string, any> = {};
          tableFilter[CouchDBKeys.TABLE] = {};
          tableFilter[CouchDBKeys.TABLE][CouchDBOperator.EQUAL] = tableName;
          indexes[name].index.partial_filter_selector = tableFilter;
        }
      }

      generate();
      if (directions)
        (directions as unknown as OrderDirection[]).forEach((d) => generate(d));
    });
  });
  return Object.values(indexes);
}
