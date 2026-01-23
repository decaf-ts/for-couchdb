import { Condition, OrderDirection } from "@decaf-ts/core";

export type ViewKey = string | string[];

export type ViewKind =
  | "view"
  | "groupBy"
  | "count"
  | "sum"
  | "max"
  | "min"
  | "distinct";

export interface ViewAuthOptions {
  expression?: string;
  field?: string;
  roles?: string[];
  mode?: "any" | "all";
}

export interface ViewOptions {
  name?: string;
  ddoc?: string;
  key?: ViewKey;
  value?: ViewKey | "doc" | null;
  map?: string | ((doc: any) => void);
  reduce?: string | ((keys: any, values: any, rereduce: boolean) => any);
  condition?: Condition<any> | string;
  auth?: string | ViewAuthOptions;
  compositions?: string[];
  directions?: OrderDirection[];
  returnDocs?: boolean;
}

export interface AggregateOptions extends ViewOptions {
  value?: any;
}

export interface ViewMetadata extends ViewOptions {
  kind: ViewKind;
  attribute: string;
}

export interface CouchDBViewDefinition {
  map: string;
  reduce?: string;
}

export interface CouchDBDesignDoc {
  _id: string;
  _rev?: string;
  language?: "javascript";
  views: Record<string, CouchDBViewDefinition>;
}

export interface ViewIndexDefinition {
  attribute: string;
  compositions?: string[];
  directions?: OrderDirection[];
}
