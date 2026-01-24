import {
  Condition,
  GroupOperator,
  OrderDirection,
  ViewKey,
  ViewKind,
} from "@decaf-ts/core";
import { DefaultSeparator } from "@decaf-ts/db-decorators";
import { Metadata } from "@decaf-ts/decoration";
import { Model } from "@decaf-ts/decorator-validation";
import { Constructor } from "@decaf-ts/decoration";
import { CouchDBKeys } from "../constants";
import { CreateIndexRequest } from "../types";
import { generateIndexDoc } from "../utils";
import { Operator } from "@decaf-ts/core";
import {
  CouchDBDesignDoc,
  CouchDBViewDefinition,
  CouchDBViewMetadata,
  CouchDBViewOptions,
  ViewIndexDefinition,
} from "./types";

function toJsLiteral(value: any): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value instanceof RegExp)
    return `new RegExp(${JSON.stringify(value.source)}, ${JSON.stringify(
      value.flags
    )})`;
  return JSON.stringify(value);
}

function conditionToJs(condition: Condition<any>, docVar: string): string {
  const { attr1, operator, comparison } = condition as unknown as {
    attr1: string | Condition<any>;
    operator: Operator | GroupOperator;
    comparison: any;
  };

  if (attr1 instanceof Condition) {
    const left = conditionToJs(attr1, docVar);
    if (operator === Operator.NOT) return `!(${left})`;
    const right = conditionToJs(comparison as Condition<any>, docVar);
    if (operator === GroupOperator.AND) return `(${left} && ${right})`;
    if (operator === GroupOperator.OR) return `(${left} || ${right})`;
    return left;
  }

  const attrExpr = `${docVar}[${JSON.stringify(attr1)}]`;
  switch (operator) {
    case Operator.EQUAL:
      return `${attrExpr} === ${toJsLiteral(comparison)}`;
    case Operator.DIFFERENT:
      return `${attrExpr} !== ${toJsLiteral(comparison)}`;
    case Operator.BIGGER:
      return `${attrExpr} > ${toJsLiteral(comparison)}`;
    case Operator.BIGGER_EQ:
      return `${attrExpr} >= ${toJsLiteral(comparison)}`;
    case Operator.SMALLER:
      return `${attrExpr} < ${toJsLiteral(comparison)}`;
    case Operator.SMALLER_EQ:
      return `${attrExpr} <= ${toJsLiteral(comparison)}`;
    case Operator.IN:
      return `(${toJsLiteral(comparison)}).indexOf(${attrExpr}) !== -1`;
    case Operator.REGEXP: {
      const regex =
        comparison instanceof RegExp
          ? toJsLiteral(comparison)
          : `new RegExp(${JSON.stringify(comparison)})`;
      return `${regex}.test(${attrExpr})`;
    }
    case Operator.NOT:
      return `!(${attrExpr} === ${toJsLiteral(comparison)})`;
    default:
      return "true";
  }
}

function buildAuthGuard(
  auth?: CouchDBViewOptions["auth"],
  docVar = "doc"
): string | undefined {
  if (!auth) return undefined;
  if (typeof auth === "string") return auth;
  const field = auth.field || "roles";
  const roles = auth.roles || [];
  if (!roles.length) return auth.expression;
  const listExpr = `${docVar}[${JSON.stringify(field)}] || []`;
  if ((auth.mode || "any") === "all") {
    return roles
      .map((r) => `${listExpr}.indexOf(${JSON.stringify(r)}) !== -1`)
      .join(" && ");
  }
  return roles
    .map((r) => `${listExpr}.indexOf(${JSON.stringify(r)}) !== -1`)
    .join(" || ");
}

function normalizeKey(
  key?: ViewKey,
  attr?: string,
  compositions?: string[]
): string[] {
  if (!key) return attr ? [attr, ...(compositions || [])] : compositions || [];
  return Array.isArray(key) ? key : [key];
}

function buildEmitKey(
  key: ViewKey | undefined,
  attr: string,
  compositions?: string[]
): string {
  const keys = normalizeKey(key, attr, compositions);
  if (keys.length === 1) return `doc[${JSON.stringify(keys[0])}]`;
  return `[${keys.map((k) => `doc[${JSON.stringify(k)}]`).join(", ")}]`;
}

function buildEmitValue(
  value: CouchDBViewOptions["value"],
  attr: string
): string {
  if (value === "doc") return "doc";
  if (!value) return `doc[${JSON.stringify(attr)}]`;
  if (Array.isArray(value))
    return `[${value.map((v) => `doc[${JSON.stringify(v)}]`).join(", ")}]`;
  if (typeof value === "string") return `doc[${JSON.stringify(value)}]`;
  return toJsLiteral(value);
}

function defaultReduce(kind: ViewKind): string | undefined {
  switch (kind) {
    case "count":
    case "groupBy":
    case "distinct":
      return "_count";
    case "sum":
      return "_sum";
    case "max":
      return `function (keys, values, rereduce) {\n  var maxVal = null;\n  for (var i = 0; i < values.length; i++) {\n    var val = values[i];\n    if (rereduce && val && typeof val === 'object' && 'value' in val) val = val.value;\n    if (maxVal === null || val > maxVal) maxVal = val;\n  }\n  return maxVal;\n}`;
    case "min":
      return `function (keys, values, rereduce) {\n  var minVal = null;\n  for (var i = 0; i < values.length; i++) {\n    var val = values[i];\n    if (rereduce && val && typeof val === 'object' && 'value' in val) val = val.value;\n    if (minVal === null || val < minVal) minVal = val;\n  }\n  return minVal;\n}`;
    default:
      return undefined;
  }
}

function buildMapFunction(
  tableName: string,
  attr: string,
  meta: CouchDBViewMetadata
): string {
  if (meta.map) {
    if (typeof meta.map === "function") return meta.map.toString();
    return meta.map;
  }

  const guards: string[] = [];
  guards.push(
    `doc[${JSON.stringify(CouchDBKeys.TABLE)}] === ${JSON.stringify(tableName)}`
  );
  if (meta.condition) {
    if (meta.condition instanceof Condition) {
      guards.push(conditionToJs(meta.condition, "doc"));
    } else if (typeof meta.condition === "string") {
      guards.push(meta.condition);
    } else {
      const resolved = Condition.from(meta.condition as any);
      guards.push(conditionToJs(resolved, "doc"));
    }
  }
  if (meta.kind === "count" && meta.value !== undefined) {
    guards.push(`doc[${JSON.stringify(attr)}] === ${toJsLiteral(meta.value)}`);
  }
  const authGuard = buildAuthGuard(meta.auth, "doc");
  if (authGuard) guards.push(authGuard);

  const guard = guards.length ? guards.join(" && ") : "true";
  const emitKey = buildEmitKey(meta.key, attr, meta.compositions);
  const emitValue = buildEmitValue(
    meta.value ?? (meta.returnDocs && meta.kind !== "sum" ? "doc" : undefined),
    attr
  );

  return `function (doc) {\n  if (!(${guard})) return;\n  emit(${emitKey}, ${emitValue});\n}`;
}

function normalizeViewMetadata(
  kind: ViewKind,
  attr: string,
  meta: CouchDBViewMetadata,
  tableName: string
): CouchDBViewDefinition {
  const map = buildMapFunction(tableName, attr, meta);
  const reduce = meta.reduce
    ? typeof meta.reduce === "function"
      ? meta.reduce.toString()
      : meta.reduce
    : defaultReduce(kind);
  return { map, reduce };
}

export function generateViewName(
  tableName: string,
  attr: string,
  kind: ViewKind,
  meta: CouchDBViewMetadata,
  separator = DefaultSeparator
): string {
  if (meta.name) return meta.name;
  const parts = [tableName, attr, kind, "view"];
  return parts.join(separator).replace(/\s+/g, "_");
}

export function generateDesignDocName(
  tableName: string,
  viewName: string,
  separator = DefaultSeparator
): string {
  return [tableName, viewName, CouchDBKeys.DDOC].join(separator);
}

export function findViewMetadata<M extends Model>(
  model: Constructor<M>,
  kind: ViewKind,
  attribute?: string
): CouchDBViewMetadata[] {
  const viewKeyMap: Record<ViewKind, Operator> = {
    view: Operator.VIEW,
    groupBy: Operator.GROUP_BY,
    count: Operator.COUNT,
    sum: Operator.SUM,
    max: Operator.MAX,
    min: Operator.MIN,
    distinct: Operator.DISTINCT,
  };
  const key = viewKeyMap[kind];
  if (!key) return [];
  const meta = Metadata.get(model, key) || {};
  return Object.entries(meta as Record<string, any>).flatMap(([attr, entries]) => {
    if (!entries || typeof entries !== "object") return [];
    return Object.values(entries as Record<string, any>)
      .map((entry) => ({
        ...(entry as CouchDBViewMetadata),
        kind,
        attribute: (entry as CouchDBViewMetadata).attribute || attr,
      }))
      .filter((entry) => !attribute || entry.attribute === attribute);
  });
}

export function collectViewMetadata(
  model: Constructor<Model>,
  key: Operator,
  kind: ViewKind
): CouchDBViewMetadata[] {
  const meta = Metadata.get(model, key) || {};
  return Object.entries(meta as Record<string, any>).flatMap(
    ([attr, entries]) => {
      if (!entries || typeof entries !== "object") return [];
      return Object.values(entries as Record<string, any>).map((entry) => {
        const value = entry as CouchDBViewMetadata;
        return {
          ...value,
          kind,
          attribute: value.attribute || attr,
        } as CouchDBViewMetadata;
      });
    }
  );
}

export function generateViews<M extends Model>(
  models: Constructor<M>[]
): CouchDBDesignDoc[] {
  const viewDocs: Record<string, CouchDBDesignDoc> = {};

  const viewKeys: [any, ViewKind][] = [
    [CouchDBKeys.VIEW, "view"],
    [Operator.GROUP_BY, "groupBy"],
    [Operator.COUNT, "count"],
    [Operator.SUM, "sum"],
    [Operator.MAX, "max"],
    [Operator.MIN, "min"],
    [Operator.DISTINCT, "distinct"],
  ];

  models.forEach((m) => {
    const tableName = Model.tableName(m);
    const metas = viewKeys.flatMap(([key, kind]) =>
      collectViewMetadata(m, key, kind)
    );

    metas.forEach((meta) => {
      const attr = meta.attribute;
      const viewName = generateViewName(tableName, attr, meta.kind, meta);
      const ddocName = meta.ddoc || generateDesignDocName(tableName, viewName);
      const ddocId = `_design/${ddocName}`;

      const viewDef = normalizeViewMetadata(meta.kind, attr, meta, tableName);
      if (!viewDocs[ddocId]) {
        viewDocs[ddocId] = {
          _id: ddocId,
          language: "javascript",
          views: {},
        };
      }
      viewDocs[ddocId].views[viewName] = viewDef;
    });
  });

  return Object.values(viewDocs);
}

export function generateViewIndexes<M extends Model>(
  models: Constructor<M>[]
): CreateIndexRequest[] {
  const indexes: Record<string, CreateIndexRequest> = {};

  const viewKeys: [any, ViewKind][] = [
    [CouchDBKeys.VIEW, "view"],
    [Operator.GROUP_BY, "groupBy"],
    [Operator.COUNT, "count"],
    [Operator.SUM, "sum"],
    [Operator.MAX, "max"],
    [Operator.MIN, "min"],
    [Operator.DISTINCT, "distinct"],
  ];

  models.forEach((m) => {
    const tableName = Model.tableName(m);
    const metas = viewKeys.flatMap(([key, kind]) =>
      collectViewMetadata(m, key, kind)
    );

    metas.forEach((meta) => {
      const key = normalizeKey(meta.key, meta.attribute, meta.compositions);
      if (!key.length) return;
      const attribute = key[0];
      const compositions = key.slice(1);
      const directions = meta.directions || [
        OrderDirection.ASC,
        OrderDirection.DSC,
      ];

      const baseIndex = generateIndexDoc(attribute, tableName, compositions);
      indexes[baseIndex.name || ""] = baseIndex;

      directions.forEach((direction) => {
        const dirIndex = generateIndexDoc(
          attribute,
          tableName,
          compositions,
          direction
        );
        indexes[dirIndex.name || ""] = dirIndex;
      });
    });
  });

  return Object.values(indexes);
}

export function viewIndexDefinition(
  meta: CouchDBViewMetadata
): ViewIndexDefinition {
  const key = normalizeKey(meta.key, meta.attribute);
  return {
    attribute: key[0],
    compositions: key.slice(1).concat(meta.compositions || []),
    directions: meta.directions,
  };
}
