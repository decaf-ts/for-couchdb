import { OrderDirection, ViewOptions, ViewKey, ViewKind } from "@decaf-ts/core";

export interface CouchDBViewOptions extends ViewOptions {
  ddoc?: string;
  value?: ViewKey | "doc" | null;
  map?: string | ((doc: any) => void);
  reduce?: string | ((keys: any, values: any, rereduce: boolean) => any);
  returnDocs?: boolean;
}

export interface CouchDBViewMetadata extends CouchDBViewOptions {
  kind: ViewKind;
  attribute: string;
}

export interface CouchDBViewDefinition {
  map: string;
  reduce?: string;
}

export interface AggregateOptions extends CouchDBViewOptions {
  value?: any;
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
