import { BaseModel, index, OrderDirection, pk } from "@decaf-ts/core";
import { Model, model, ModelArg } from "@decaf-ts/decorator-validation";
import { uses } from "@decaf-ts/decoration";
import {
  generateIndexes,
  generateModelIndexName,
} from "../../../src/indexes/generator";
import { CouchDBKeys } from "../../../src/constants";

class CompositeIndexModel extends BaseModel {}

describe("generateIndexes", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates direction-specific indexes for indexed compositions", () => {
    jest.spyOn(Model, "indexes").mockReturnValue({
      primary: {
        index: {
          directions: [OrderDirection.ASC, OrderDirection.DSC],
          compositions: ["secondary"],
          name: undefined,
        },
      },
    } as any);

    jest
      .spyOn(Model, "tableName")
      .mockReturnValue("composite_index_model");

    const indexes = generateIndexes([CompositeIndexModel]);

    const baseIndex = indexes.find(
      (idx) =>
        Array.isArray(idx.index.fields) &&
        (idx.index.fields as any[]).includes(CouchDBKeys.TABLE)
    );
    expect(baseIndex).toBeDefined();

    const sortedFields = indexes
      .map((idx) => idx.index.fields)
      .filter(
        (
          fields
        ): fields is Record<string, OrderDirection>[] =>
          Array.isArray(fields) &&
          typeof fields[0] === "object" &&
          typeof fields[1] === "object" &&
          "primary" in (fields[1] as Record<string, OrderDirection>)
      );

    const sortedFieldsWithoutTable = sortedFields.map((fields) =>
      fields.slice(1)
    );

    expect(sortedFieldsWithoutTable.length).toBe(2);

    const expectedCombos = [
      [
        { primary: OrderDirection.ASC },
        { secondary: OrderDirection.ASC },
      ],
      [
        { primary: OrderDirection.DSC },
        { secondary: OrderDirection.DSC },
      ],
    ];

    expectedCombos.forEach((combo) => {
      expect(sortedFieldsWithoutTable).toEqual(
        expect.arrayContaining([combo])
      );
    });
  });

  it("indexes default query attributes", () => {
    class DefaultAttrModel extends BaseModel {}

    jest.spyOn(Model, "indexes").mockReturnValue({} as any);
    jest
      .spyOn(Model, "defaultQueryAttributes")
      .mockReturnValue(["defaultAttr"] as any);
    jest.spyOn(Model, "tableName").mockReturnValue("default_attr_model");

    const indexes = generateIndexes([DefaultAttrModel]);

    const defaultIndex = indexes.find(
      (idx) =>
        idx.name?.includes("default_attr_model") &&
        Array.isArray(idx.index.fields) &&
        (idx.index.fields as any[])[1] === "defaultAttr"
    );
    expect(defaultIndex).toBeDefined();
    const sortedDefaultIndexes = indexes.filter(
      (idx) =>
        Array.isArray(idx.index.fields) &&
        typeof (idx.index.fields as any[])[1] === "object" &&
        (idx.index.fields as any[])[1]["defaultAttr"] !== undefined
    );
    expect(sortedDefaultIndexes.length).toBe(2);

    jest.restoreAllMocks();
  });

  it("generates @index-compatible names", () => {
    expect(
      generateModelIndexName(
        "assets",
        "owner",
        ["createdAt"],
        OrderDirection.ASC
      )
    ).toBe("assets_owner_createdAt_asc_index");
  });

  it("generates both plain and composite indexes from real @index metadata on the same property", () => {
    @uses("ram")
    @model()
    class RealCompositeIndexModel extends Model {
      @pk()
      id!: string;

      @index([OrderDirection.ASC, OrderDirection.DSC])
      @index([OrderDirection.ASC, OrderDirection.DSC], ["id"])
      status!: string;

      constructor(arg?: ModelArg<RealCompositeIndexModel>) {
        super(arg);
      }
    }

    const tableName = Model.tableName(RealCompositeIndexModel);
    const indexes = generateIndexes([RealCompositeIndexModel]);
    const names = indexes.map((idx) => idx.name);

    expect(names).toEqual(
      expect.arrayContaining([
        `${tableName}_status_asc_index`,
        `${tableName}_status_desc_index`,
        `${tableName}_status_id_asc_index`,
        `${tableName}_status_id_desc_index`,
      ])
    );

    const compositeAsc = indexes.find(
      (idx) => idx.name === `${tableName}_status_id_asc_index`
    );
    expect(compositeAsc?.index.fields).toEqual([
      { [CouchDBKeys.TABLE]: OrderDirection.ASC },
      { status: OrderDirection.ASC },
      { id: OrderDirection.ASC },
    ]);
  });
});
