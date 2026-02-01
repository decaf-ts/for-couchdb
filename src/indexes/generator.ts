import { IndexMetadata, OrderDirection, PersistenceKeys } from "@decaf-ts/core";
import { CouchDBKeys } from "../constants";
import { DefaultSeparator } from "@decaf-ts/db-decorators";
import { Model } from "@decaf-ts/decorator-validation";
import { CouchDBOperator } from "../query/constants";
import { CreateIndexRequest } from "../types";
import { Constructor } from "@decaf-ts/decoration";
import { generateViewIndexes } from "../views";

/**
 * @description Generates a name for a CouchDB index
 * @summary Creates a standardized name for a CouchDB index by combining name parts, compositions, and direction
 * @param {string[]} name - Array of name parts for the index
 * @param {OrderDirection} [direction] - Optional sort direction for the index
 * @param {string[]} [compositions] - Optional additional attributes to include in the index name
 * @param {string} [separator=DefaultSeparator] - The separator to use between parts of the index name
 * @return {string} The generated index name
 * @memberOf module:for-couchdb
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
 * @param models - Array of model constructors to generate indexes for
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
    const modelTableName = Model.tableName(m);
    let defaultQueryAttrs: string[] = [];
    try {
      defaultQueryAttrs = Model.defaultQueryAttributes(m);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      defaultQueryAttrs = [];
    }
    defaultQueryAttrs.forEach((attr) => {
      const baseName = generateIndexName([
        modelTableName,
        attr,
        "defaultQuery",
      ]);
      const defaultFilter: Record<string, any> = {
        [CouchDBKeys.TABLE]: {
          [CouchDBOperator.EQUAL]: modelTableName,
        },
      };
      indexes[baseName] = {
        index: {
          fields: [CouchDBKeys.TABLE, attr],
        },
        name: baseName,
        ddoc: baseName,
        type: "json",
      };
      indexes[baseName].index.partial_filter_selector = defaultFilter;

      [OrderDirection.ASC, OrderDirection.DSC].forEach((direction) => {
        const sortedName = generateIndexName(
          [modelTableName, attr, "defaultQuery"],
          direction
        );
        indexes[sortedName] = {
          index: {
            fields: [
              {
                [CouchDBKeys.TABLE]: direction,
              },
              {
                [attr]: direction,
              },
            ],
          },
          name: sortedName,
          ddoc: sortedName,
          type: "json",
        };
      });
    });

    const ind: Record<string, IndexMetadata> = Model.indexes(m);
    Object.entries(ind).forEach(([key, value]) => {
      const metadataEntries: [string, IndexMetadata][] = [];
      Object.entries(value || {}).forEach(([, metadataValue]) => {
        if (!metadataValue) return;
        const candidate = metadataValue as IndexMetadata;
        if (
          candidate.directions !== undefined ||
          candidate.compositions !== undefined
        ) {
          metadataEntries.push([key, candidate]);
          return;
        }
        if (
          typeof metadataValue === "object" &&
          !Array.isArray(metadataValue)
        ) {
          const nested = metadataValue as Record<string, IndexMetadata>;
          Object.entries(nested).forEach(([field, meta]) => {
            if (meta) metadataEntries.push([field, meta]);
          });
        }
      });

      metadataEntries.forEach(([fieldKey, meta]) => {
        if (!meta) return;
        // eslint-disable-next-line prefer-const
        let { directions, compositions } = meta as any;
        const tableName = modelTableName;
        compositions = compositions || [];
        const fieldKeys = [fieldKey, ...(compositions as string[])];

        const tableFilter: Record<string, any> = {
          [CouchDBKeys.TABLE]: {
            [CouchDBOperator.EQUAL]: tableName,
          },
        };

        function generate(sort?: OrderDirection, suffix?: string) {
          const name = [
            tableName,
            fieldKey,
            ...(compositions as []),
            ...(suffix ? [suffix] : []),
            PersistenceKeys.INDEX,
          ].join(DefaultSeparator);

          const baseFields = [CouchDBKeys.TABLE, ...fieldKeys];
          const fields = sort
            ? [
                {
                  [CouchDBKeys.TABLE]: sort,
                },
                ...fieldKeys.map((sortField) => ({
                  [sortField]: sort,
                })),
              ]
            : baseFields;

          indexes[name] = {
            index: {
              fields,
            },
            name,
            ddoc: name,
            type: "json",
          };
          if (!sort) {
            indexes[name].index.partial_filter_selector = tableFilter;
          }
        }

        generate();
        const normalizedDirections = Array.from(
          new Set(
            (directions || [OrderDirection.ASC]).map(
              (dir: OrderDirection | string) => String(dir).toLowerCase()
            )
          )
        );

        const validDirections = normalizedDirections.filter(
          (dir): dir is OrderDirection =>
            dir === OrderDirection.ASC || dir === OrderDirection.DSC
        );

        validDirections.forEach((direction) => {
          generate(direction, direction);
        });
      });
    });
  });

  generateViewIndexes(models).forEach((index) => {
    if (!index.name) return;
    indexes[index.name] = index;
  });

  return Object.values(indexes);
}
