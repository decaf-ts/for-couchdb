import {
  BaseModel,
  defaultQueryAttr,
  index,
  OrderDirection,
  table,
} from "@decaf-ts/core";
import { generateIndexes } from "../../../src/indexes/generator";
import { CouchDBKeys } from "../../../src/constants";

describe("generateIndexes", () => {
  it("creates direction-specific indexes for indexed compositions (no mocking)", () => {
    @table("composite_index_model")
    class CompositeIndexModel extends BaseModel {
      @index([OrderDirection.ASC, OrderDirection.DSC], ["secondary"])
      primary!: string;

      secondary!: string;
    }

    const indexes = generateIndexes([CompositeIndexModel]);

    // Per-table base "table" index must exist and be scoped to this model table.
    const baseTableName = "composite_index_model_table_index";
    const baseTableIndex = indexes.find((idx) => idx.name === baseTableName) as any;
    expect(baseTableIndex).toBeDefined();
    expect(baseTableIndex.index.fields).toEqual([CouchDBKeys.TABLE]);
    expect(baseTableIndex.index.partial_filter_selector).toEqual({
      [CouchDBKeys.TABLE]: { $eq: "composite_index_model" },
    });

    const baseName = "composite_index_model_primary_secondary_index";
    const baseIndex = indexes.find((idx) => idx.name === baseName) as any;
    expect(baseIndex).toBeDefined();
    expect(baseIndex.index.fields).toEqual([
      CouchDBKeys.TABLE,
      "primary",
      "secondary",
    ]);
    expect(baseIndex.index.partial_filter_selector).toEqual({
      [CouchDBKeys.TABLE]: { $eq: "composite_index_model" },
    });

    const ascName = "composite_index_model_primary_secondary_asc_index";
    const ascIndex = indexes.find((idx) => idx.name === ascName) as any;
    expect(ascIndex).toBeDefined();
    expect(ascIndex.index.fields).toEqual([
      { [CouchDBKeys.TABLE]: OrderDirection.ASC },
      { primary: OrderDirection.ASC },
      { secondary: OrderDirection.ASC },
    ]);
    expect(ascIndex.index.partial_filter_selector).toEqual({
      [CouchDBKeys.TABLE]: { $eq: "composite_index_model" },
    });

    const descName = "composite_index_model_primary_secondary_desc_index";
    const descIndex = indexes.find((idx) => idx.name === descName) as any;
    expect(descIndex).toBeDefined();
    expect(descIndex.index.fields).toEqual([
      { [CouchDBKeys.TABLE]: OrderDirection.DSC },
      { primary: OrderDirection.DSC },
      { secondary: OrderDirection.DSC },
    ]);
    expect(descIndex.index.partial_filter_selector).toEqual({
      [CouchDBKeys.TABLE]: { $eq: "composite_index_model" },
    });
  });

  it("indexes default query attributes for each order (no mocking)", () => {
    @table("default_attr_model")
    class DefaultAttrModel extends BaseModel {
      @defaultQueryAttr()
      defaultAttr!: string;
    }

    const indexes = generateIndexes([DefaultAttrModel]);

    const baseName = "default_attr_model_defaultAttr_defaultQuery_index";
    const baseIndex = indexes.find((idx) => idx.name === baseName) as any;
    expect(baseIndex).toBeDefined();
    expect(baseIndex.index.fields).toEqual([CouchDBKeys.TABLE, "defaultAttr"]);
    expect(baseIndex.index.partial_filter_selector).toEqual({
      [CouchDBKeys.TABLE]: { $eq: "default_attr_model" },
    });

    const ascName = "default_attr_model_defaultAttr_defaultQuery_asc_index";
    const ascIndex = indexes.find((idx) => idx.name === ascName) as any;
    expect(ascIndex).toBeDefined();
    expect(ascIndex.index.fields).toEqual([
      { [CouchDBKeys.TABLE]: OrderDirection.ASC },
      { defaultAttr: OrderDirection.ASC },
    ]);
    expect(ascIndex.index.partial_filter_selector).toEqual({
      [CouchDBKeys.TABLE]: { $eq: "default_attr_model" },
    });

    const descName = "default_attr_model_defaultAttr_defaultQuery_desc_index";
    const descIndex = indexes.find((idx) => idx.name === descName) as any;
    expect(descIndex).toBeDefined();
    expect(descIndex.index.fields).toEqual([
      { [CouchDBKeys.TABLE]: OrderDirection.DSC },
      { defaultAttr: OrderDirection.DSC },
    ]);
    expect(descIndex.index.partial_filter_selector).toEqual({
      [CouchDBKeys.TABLE]: { $eq: "default_attr_model" },
    });
  });

  it("creates composed indexes and uses composed attributes in the generated name (no mocking)", () => {
    @table("audit")
    class AuditModel extends BaseModel {
      @index([OrderDirection.ASC, OrderDirection.DSC], ["createdAt"])
      recordId!: string;

      createdAt!: Date;
    }

    const indexes = generateIndexes([AuditModel]);

    const baseName = "audit_recordId_createdAt_index";
    const baseIndex = indexes.find((idx) => idx.name === baseName) as any;
    expect(baseIndex).toBeDefined();
    expect(baseIndex.type).toBe("json");
    expect(baseIndex.index.fields).toEqual([
      CouchDBKeys.TABLE,
      "recordId",
      "createdAt",
    ]);
    expect(baseIndex.index.partial_filter_selector).toEqual({
      [CouchDBKeys.TABLE]: { $eq: "audit" },
    });

    const ascName = "audit_recordId_createdAt_asc_index";
    const ascIndex = indexes.find((idx) => idx.name === ascName) as any;
    expect(ascIndex).toBeDefined();
    expect(ascIndex.index.fields).toEqual([
      { [CouchDBKeys.TABLE]: OrderDirection.ASC },
      { recordId: OrderDirection.ASC },
      { createdAt: OrderDirection.ASC },
    ]);
    expect(ascIndex.index.partial_filter_selector).toEqual({
      [CouchDBKeys.TABLE]: { $eq: "audit" },
    });

    const descName = "audit_recordId_createdAt_desc_index";
    const descIndex = indexes.find((idx) => idx.name === descName) as any;
    expect(descIndex).toBeDefined();
    expect(descIndex.index.fields).toEqual([
      { [CouchDBKeys.TABLE]: OrderDirection.DSC },
      { recordId: OrderDirection.DSC },
      { createdAt: OrderDirection.DSC },
    ]);
    expect(descIndex.index.partial_filter_selector).toEqual({
      [CouchDBKeys.TABLE]: { $eq: "audit" },
    });
  });
});
