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

/**
 * @description Generates a name for a CouchDB index
 * @summary Creates a standardized name for a CouchDB index by combining name parts, compositions, and direction
 * @param {string[]} name - Array of name parts for the index
 * @param {OrderDirection} [direction] - Optional sort direction for the index
 * @param {string[]} [compositions] - Optional additional attributes to include in the index name
 * @param {string} [separator=DefaultSeparator] - The separator to use between parts of the index name
 * @return {string} The generated index name
 */
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

/**
 * @description Generates CouchDB index configurations for models
 * @summary Creates a set of CouchDB index configurations based on the metadata of the provided models
 * @template M - The model type that extends Model
 * @param {Constructor<M>[]} models - Array of model constructors to generate indexes for
 * @return {CreateIndexRequest[]} Array of CouchDB index configurations
 * @function generateIndexes
 * @memberOf module:for-couchdb
 * @mermaid
 * sequenceDiagram
 *   participant Caller
 *   participant generateIndexes
 *   participant generateIndexName
 *   participant Repository
 *   
 *   Caller->>generateIndexes: models
 *   
 *   Note over generateIndexes: Create base table index
 *   generateIndexes->>generateIndexName: [CouchDBKeys.TABLE]
 *   generateIndexName-->>generateIndexes: tableName
 *   generateIndexes->>generateIndexes: Create table index config
 *   
 *   loop For each model
 *     generateIndexes->>Repository: Get indexes metadata
 *     Repository-->>generateIndexes: index metadata
 *     
 *     loop For each index in metadata
 *       Note over generateIndexes: Extract index properties
 *       generateIndexes->>Repository: Get table name
 *       Repository-->>generateIndexes: tableName
 *       
 *       Note over generateIndexes: Define nested generate function
 *       
 *       generateIndexes->>generateIndexes: Call generate() for default order
 *       Note over generateIndexes: Create index name and config
 *       
 *       alt Has directions
 *         loop For each direction
 *           generateIndexes->>generateIndexes: Call generate(direction)
 *           Note over generateIndexes: Create ordered index config
 *         end
 *       end
 *     end
 *   end
 *   
 *   generateIndexes-->>Caller: Array of index configurations
 */
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
