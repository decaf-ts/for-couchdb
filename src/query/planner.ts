import { OrderDirection } from "@decaf-ts/core";
import { Constructor } from "@decaf-ts/decoration";
import { Model } from "@decaf-ts/decorator-validation";
import { CouchDBKeys } from "../constants";
import { CouchDBGroupOperator, CouchDBOperator } from "./constants";
import { MangoQuery, MangoSelector, SortOrder } from "../types";
import {
  generateIndexName,
  generateModelIndexName,
} from "../indexes/generator";
import { IndexPlanningError } from "../errors/IndexPlanningError";

export type MangoIndexCandidate = {
  name: string;
  ddoc: string;
  fields: string[];
  direction?: OrderDirection;
  source: "table" | "defaultQuery" | "index";
};

export type MangoIndexResolution = {
  candidate: MangoIndexCandidate;
  use_index: string | [string, string];
};

export type MangoPlannerLog = {
  debug?: (message: string) => void;
  warn?: (message: string) => void;
};

export type RequiredMangoIndexShape = {
  tableName: string;
  modelName: string;
  equalityFields: string[];
  rangeFields: string[];
  sortFields: string[];
  sortDirection?: OrderDirection;
  requiredFields: string[];
};

export type ReversedIndexDeclaration = {
  attribute: string;
  compositions: string[];
  directions: OrderDirection[];
  name: string;
  ddoc: string;
  fields: Array<string | Record<string, OrderDirection>>;
  decorator: string;
};

const SCAN_PRONE_OPERATORS = new Set([
  "$or",
  "$in",
  "$regex",
  "$nin",
  "$not",
  "$ne",
  "$nor",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function selectorContainsOperator(node: any, operator: string): boolean {
  if (!node || typeof node !== "object") return false;

  if (Array.isArray(node)) {
    return node.some((child) => selectorContainsOperator(child, operator));
  }

  return Object.entries(node).some(
    ([key, value]) => key === operator || selectorContainsOperator(value, operator)
  );
}

export function normalizeSortField(
  entry: SortOrder
): { field: string; direction?: OrderDirection } | undefined {
  if (typeof entry === "string") {
    return { field: entry };
  }

  if (Array.isArray(entry)) {
    return entry.length ? { field: String(entry[0]) } : undefined;
  }

  const [field, direction] = Object.entries(entry || {})[0] || [];
  if (!field) return undefined;

  return {
    field,
    direction: String(direction || OrderDirection.ASC).toLowerCase() as OrderDirection,
  };
}

export function getSortFields(query: MangoQuery): string[] {
  return (query.sort || [])
    .map(normalizeSortField)
    .filter(Boolean)
    .map((entry) => entry!.field);
}

export function getSortDirection(
  query: MangoQuery
): OrderDirection | undefined {
  return (query.sort || [])
    .map(normalizeSortField)
    .find(Boolean)?.direction;
}

export function getEqualitySelectorFields(
  selector: MangoSelector = {}
): Set<string> {
  const fields = new Set<string>();

  const visit = (node: any): void => {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (Array.isArray(node[CouchDBGroupOperator.AND])) {
      node[CouchDBGroupOperator.AND].forEach(visit);
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === CouchDBGroupOperator.OR || key === CouchDBGroupOperator.AND) {
        visit(value);
        continue;
      }

      if (!isPlainObject(value)) {
        fields.add(key);
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(value, CouchDBOperator.EQUAL)) {
        fields.add(key);
      }
    }
  };

  visit(selector);
  return fields;
}

export function getRangeSelectorFields(
  selector: MangoSelector = {}
): Set<string> {
  const fields = new Set<string>();

  const visit = (node: any): void => {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (Array.isArray(node[CouchDBGroupOperator.AND])) {
      node[CouchDBGroupOperator.AND].forEach(visit);
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === CouchDBGroupOperator.OR || key === CouchDBGroupOperator.AND) {
        visit(value);
        continue;
      }

      if (!isPlainObject(value)) continue;

      if (
        Object.prototype.hasOwnProperty.call(value, CouchDBOperator.BIGGER) ||
        Object.prototype.hasOwnProperty.call(value, CouchDBOperator.BIGGER_EQ) ||
        Object.prototype.hasOwnProperty.call(value, CouchDBOperator.SMALLER) ||
        Object.prototype.hasOwnProperty.call(value, CouchDBOperator.SMALLER_EQ)
      ) {
        fields.add(key);
      }
    }
  };

  visit(selector);
  return fields;
}

function collectGeneratedIndexEntries(clazz: Constructor): MangoIndexCandidate[] {
  const tableName = Model.tableName(clazz);
  const candidates: MangoIndexCandidate[] = [];

  const tableIndexName = generateIndexName([CouchDBKeys.TABLE]);
  candidates.push({
    name: tableIndexName,
    ddoc: tableIndexName,
    fields: [CouchDBKeys.TABLE],
    source: "table",
  });

  let defaultQueryAttrs: string[] = [];
  try {
    defaultQueryAttrs = Model.defaultQueryAttributes(clazz) as string[];
  } catch {
    defaultQueryAttrs = [];
  }

  for (const attr of defaultQueryAttrs) {
    const baseName = generateIndexName([tableName, attr, "defaultQuery"]);
    candidates.push({
      name: baseName,
      ddoc: baseName,
      fields: [CouchDBKeys.TABLE, attr],
      source: "defaultQuery",
    });

    for (const direction of [OrderDirection.ASC, OrderDirection.DSC]) {
      const sortedName = generateIndexName(
        [tableName, attr, "defaultQuery"],
        direction
      );
      candidates.push({
        name: sortedName,
        ddoc: sortedName,
        fields: [CouchDBKeys.TABLE, attr],
        direction,
        source: "defaultQuery",
      });
    }
  }

  const modelIndexes = Model.indexes(clazz) as Record<
    string,
    Record<string, any>
  >;

  Object.entries(modelIndexes || {}).forEach(([fieldKey, value]) => {
    Object.values(value || {}).forEach((metadataValue) => {
      if (!metadataValue || !isPlainObject(metadataValue)) return;

      const meta = metadataValue as {
        directions?: Array<OrderDirection | string>;
        compositions?: string[];
      };
      const compositions = meta.compositions || [];
      const directions = meta.directions || [OrderDirection.ASC];
      const fields = [CouchDBKeys.TABLE, fieldKey, ...compositions];

      const baseName = generateModelIndexName(tableName, fieldKey, compositions);
      candidates.push({
        name: baseName,
        ddoc: baseName,
        fields,
        source: "index",
      });

      const validDirections = Array.from(
        new Set(directions.map((dir) => String(dir).toLowerCase()))
      ).filter(
        (dir): dir is OrderDirection =>
          dir === OrderDirection.ASC || dir === OrderDirection.DSC
      );

      for (const direction of validDirections) {
        const sortedName = generateModelIndexName(
          tableName,
          fieldKey,
          compositions,
          direction
        );
        candidates.push({
          name: sortedName,
          ddoc: sortedName,
          fields,
          direction,
          source: "index",
        });
      }
    });
  });

  return candidates;
}

export function buildGeneratedIndexCandidates(
  clazz: Constructor
): MangoIndexCandidate[] {
  return collectGeneratedIndexEntries(clazz);
}

export function findGeneratedIndexCandidateByName(
  clazz: Constructor,
  expectedName: string
): MangoIndexCandidate | undefined {
  return collectGeneratedIndexEntries(clazz).find(
    (candidate) =>
      candidate.name === expectedName || candidate.ddoc === expectedName
  );
}

export function resolveGeneratedIndexForQuery(
  clazz: Constructor,
  query: MangoQuery,
  options: {
    preserveDefaultQuery?: boolean;
    requireSortCoverage?: boolean;
  } = {}
): MangoIndexResolution | undefined {
  if (query.use_index) return undefined;

  // A single named index cannot be proven valid for selectors combining
  // branches via $or/$nor, since CouchDB only treats an index as usable when
  // its leading fields constrain every branch of the selector. Forcing a
  // use_index hint here causes CouchDB to reject it as "not a valid index for
  // this query" - so let CouchDB pick (or fall back) on its own instead.
  if (
    selectorContainsOperator(query.selector, CouchDBGroupOperator.OR) ||
    selectorContainsOperator(query.selector, "$nor")
  ) {
    return undefined;
  }

  const preserveDefaultQuery = options.preserveDefaultQuery !== false;
  const candidates = collectGeneratedIndexEntries(clazz);
  const equalityFields = getEqualitySelectorFields(query.selector);
  const rangeFields = getRangeSelectorFields(query.selector);
  const sortFields = getSortFields(query);
  const sortDirection = getSortDirection(query);

  equalityFields.add(CouchDBKeys.TABLE);

  const scored = candidates
    .map((candidate) => {
      if (
        candidate.direction &&
        sortDirection &&
        candidate.direction !== sortDirection
      ) {
        return undefined;
      }

      if (!candidate.fields.includes(CouchDBKeys.TABLE)) return undefined;
      if (candidate.fields[0] !== CouchDBKeys.TABLE) return undefined;

      const candidateFields = candidate.fields.filter(
        (field) => field !== CouchDBKeys.TABLE
      );
      const coversAllSort =
        sortFields.length === 0 ||
        sortFields.every((field) => candidateFields.includes(field));
      const coversSomeSort = sortFields.some((field) =>
        candidateFields.includes(field)
      );
      const coversAllRange =
        rangeFields.size === 0 ||
        Array.from(rangeFields).every((field) => candidateFields.includes(field));
      const coversSomeRange = Array.from(rangeFields).some((field) =>
        candidateFields.includes(field)
      );

      if (options.requireSortCoverage && sortFields.length && !coversAllSort) {
        return undefined;
      }

      const equalityCoverage = candidateFields.filter((field) =>
        equalityFields.has(field)
      ).length;
      const rangeCoverage = candidateFields.filter((field) =>
        rangeFields.has(field)
      ).length;
      const sortCoverage = candidateFields.filter((field) =>
        sortFields.includes(field)
      ).length;

      if (!equalityCoverage && !rangeCoverage && !sortCoverage) {
        return undefined;
      }

      let score = 0;
      if (candidate.source === "defaultQuery" && preserveDefaultQuery) {
        score += 100;
      }
      if (candidate.source === "index") score += 50;
      score += equalityCoverage * 30;
      score += rangeCoverage * 25;
      score += sortCoverage * 20;
      if (coversAllSort && sortFields.length) score += 20;
      if (coversAllRange && rangeFields.size) score += 20;
      if (coversSomeSort) score += 5;
      if (coversSomeRange) score += 5;
      if (candidate.direction && sortDirection) score += 10;

      return { candidate, score };
    })
    .filter(Boolean) as Array<{ candidate: MangoIndexCandidate; score: number }>;

  if (!scored.length) return undefined;

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.candidate.fields.length - b.candidate.fields.length;
  });

  const best = scored[0].candidate;
  return {
    candidate: best,
    use_index: [best.ddoc, best.name],
  };
}

export function getRequiredMangoIndexShape(
  clazz: Constructor,
  query: MangoQuery
): RequiredMangoIndexShape {
  const tableName = Model.tableName(clazz);
  const modelName = clazz.name;
  const equalityFields = Array.from(getEqualitySelectorFields(query.selector));
  const rangeFields = Array.from(getRangeSelectorFields(query.selector));
  const sortFields = getSortFields(query);
  const sortDirection = getSortDirection(query);
  const requiredFields: string[] = [CouchDBKeys.TABLE];

  for (const field of equalityFields) {
    if (field !== CouchDBKeys.TABLE && !requiredFields.includes(field)) {
      requiredFields.push(field);
    }
  }
  for (const field of rangeFields) {
    if (field !== CouchDBKeys.TABLE && !requiredFields.includes(field)) {
      requiredFields.push(field);
    }
  }
  for (const field of sortFields) {
    if (field !== CouchDBKeys.TABLE && !requiredFields.includes(field)) {
      requiredFields.push(field);
    }
  }

  return {
    tableName,
    modelName,
    equalityFields,
    rangeFields,
    sortFields,
    sortDirection,
    requiredFields,
  };
}

export function reverseRequiredShapeToIndexDeclaration(
  clazz: Constructor,
  query: MangoQuery
): ReversedIndexDeclaration {
  const shape = getRequiredMangoIndexShape(clazz, query);
  const nonTableFields = shape.requiredFields.filter(
    (field) => field !== CouchDBKeys.TABLE
  );

  if (!nonTableFields.length) {
    throw new IndexPlanningError(
      "Cannot infer @index declaration for query with no model fields.",
      {
        modelName: shape.modelName,
        tableName: shape.tableName,
        attribute: "",
        compositions: [],
        directions: [],
        expectedName: "",
        expectedDdoc: "",
        expectedFields: [CouchDBKeys.TABLE],
        decorator: "",
      },
      query
    );
  }

  const attribute = nonTableFields[0];
  const compositions = nonTableFields.slice(1);
  const direction = shape.sortDirection || OrderDirection.ASC;
  const name = generateModelIndexName(
    shape.tableName,
    attribute,
    compositions,
    direction
  );
  const fields: Array<string | Record<string, OrderDirection>> = [
    { [CouchDBKeys.TABLE]: direction },
    { [attribute]: direction },
    ...compositions.map((field) => ({ [field]: direction })),
  ];

  const decorator = [
    "@index({",
    compositions.length
      ? `  compositions: ${JSON.stringify(compositions)},`
      : undefined,
    `  directions: ${JSON.stringify([direction])}`,
    "})",
    `${attribute}!: <type>;`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    attribute,
    compositions,
    directions: [direction],
    name,
    ddoc: name,
    fields,
    decorator,
  };
}

export function attachGeneratedUseIndex(
  clazz: Constructor | undefined,
  query: MangoQuery,
  log?: MangoPlannerLog,
  options: {
    preserveDefaultQuery?: boolean;
    requireSortCoverage?: boolean;
    requireIndex?: boolean;
    forceNamedIndexes?: boolean;
  } = {}
): void {
  if (!clazz || query.use_index) return;

  if (options.forceNamedIndexes === false && !options.requireIndex) {
    return;
  }

  const resolved = resolveGeneratedIndexForQuery(clazz, query, {
    preserveDefaultQuery: options.preserveDefaultQuery ?? true,
    requireSortCoverage: options.requireSortCoverage ?? false,
  });

  if (resolved) {
    query.use_index = resolved.use_index;
    log?.debug?.(
      `Attached Mango use_index=${JSON.stringify(resolved.use_index)} from ${resolved.candidate.source} metadata`
    );
    return;
  }

  if (!options.requireIndex) return;

  const reversed = reverseRequiredShapeToIndexDeclaration(clazz, query);
  throw new IndexPlanningError(
    [
      "No generated CouchDB index can satisfy this Mango query.",
      "",
      `Model: ${clazz.name}`,
      `Table: ${shapeTableName(clazz)}`,
      "",
      "To allow this query, declare the following index on the model attribute:",
      "",
      reversed.decorator,
      "",
      "Then regenerate/deploy indexes.",
      "",
      "Expected generated index:",
      `  ddoc: ${reversed.ddoc}`,
      `  name: ${reversed.name}`,
      `  fields: ${JSON.stringify(reversed.fields)}`,
    ].join("\n"),
    {
      modelName: clazz.name,
      tableName: shapeTableName(clazz),
      attribute: reversed.attribute,
      compositions: reversed.compositions,
      directions: reversed.directions,
      expectedName: reversed.name,
      expectedDdoc: reversed.ddoc,
      expectedFields: reversed.fields,
      decorator: reversed.decorator,
    },
    query
  );
}

function shapeTableName(clazz: Constructor): string {
  return Model.tableName(clazz);
}

export function requireGeneratedUseIndex(
  clazz: Constructor,
  query: MangoQuery,
  log?: MangoPlannerLog,
  options: {
    requireSortCoverage?: boolean;
  } = {}
): void {
  attachGeneratedUseIndex(clazz, query, log, {
    preserveDefaultQuery: true,
    requireSortCoverage: options.requireSortCoverage ?? true,
    requireIndex: true,
    forceNamedIndexes: true,
  });
}

export function warnScanProneMangoOperators(
  selector: unknown,
  log?: MangoPlannerLog,
  path = "selector"
): void {
  if (!selector || typeof selector !== "object") return;

  if (Array.isArray(selector)) {
    selector.forEach((entry, index) =>
      warnScanProneMangoOperators(entry, log, `${path}[${index}]`)
    );
    return;
  }

  for (const [key, value] of Object.entries(selector as Record<string, unknown>)) {
    if (SCAN_PRONE_OPERATORS.has(key)) {
      log?.warn?.(
        `Mango query contains scan-prone operator ${key} at ${path}. This may bypass or weaken index usage and can produce slow queries.`
      );
    }
    warnScanProneMangoOperators(value, log, `${path}.${key}`);
  }
}

export function ensureDeterministicSort(
  query: MangoQuery,
  tieBreaker: string,
  direction?: OrderDirection
): void {
  if (!query.sort?.length) return;

  const sortFields = getSortFields(query);
  if (sortFields.includes(tieBreaker)) return;

  const effectiveDirection =
    direction || getSortDirection(query) || OrderDirection.ASC;

  query.sort = [...query.sort, { [tieBreaker]: effectiveDirection }];
}

export function enableMangoExecutionStats(query: MangoQuery): void {
  query.execution_stats = true;
}
