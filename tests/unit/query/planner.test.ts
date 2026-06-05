import { BaseModel, OrderDirection } from "@decaf-ts/core";
import { Model } from "@decaf-ts/decorator-validation";
import {
  attachGeneratedUseIndex,
  requireGeneratedUseIndex,
  reverseRequiredShapeToIndexDeclaration,
} from "../../../src/query/planner";
import { IndexPlanningError } from "../../../src/errors/IndexPlanningError";
import { MangoQuery } from "../../../src/types";

class Asset extends BaseModel {}

describe("query planner", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockAssetMetadata(indexes: Record<string, any> = {}): void {
    jest.spyOn(Model, "tableName").mockReturnValue("assets");
    jest.spyOn(Model, "indexes").mockReturnValue(indexes as any);
    jest
      .spyOn(Model, "defaultQueryAttributes")
      .mockReturnValue([] as any);
  }

  it("attaches generated @index use_index when forceNamedIndexes is enabled", () => {
    mockAssetMetadata({
      owner: {
        index: {
          directions: [OrderDirection.ASC],
          compositions: ["createdAt"],
        },
      },
    });

    const query: MangoQuery = {
      selector: {
        "??table": "assets",
        owner: "alice",
        createdAt: { $gt: "2026-01-01" },
      },
      sort: [{ createdAt: "asc" }],
    };

    const log = {
      debug: jest.fn(),
      warn: jest.fn(),
    };

    attachGeneratedUseIndex(Asset, query, log, {
      forceNamedIndexes: true,
    });

    expect(query.use_index).toEqual([
      "assets_owner_createdAt_asc_index",
      "assets_owner_createdAt_asc_index",
    ]);
  });

  it("does not attach generated @index use_index when forceNamedIndexes is disabled", () => {
    mockAssetMetadata({
      owner: {
        index: {
          directions: [OrderDirection.ASC],
          compositions: ["createdAt"],
        },
      },
    });

    const query: MangoQuery = {
      selector: {
        "??table": "assets",
        owner: "alice",
        createdAt: { $gt: "2026-01-01" },
      },
      sort: [{ createdAt: "asc" }],
    };

    attachGeneratedUseIndex(Asset, query, undefined, {
      forceNamedIndexes: false,
    });

    expect(query.use_index).toBeUndefined();
  });

  it("preserves an explicit use_index", () => {
    mockAssetMetadata({
      owner: {
        index: {
          directions: [OrderDirection.ASC],
          compositions: ["createdAt"],
        },
      },
    });

    const query: MangoQuery = {
      selector: {
        "??table": "assets",
        owner: "alice",
      },
      use_index: ["custom-ddoc", "custom-index"],
    };

    attachGeneratedUseIndex(Asset, query, undefined, {
      forceNamedIndexes: true,
    });

    expect(query.use_index).toEqual(["custom-ddoc", "custom-index"]);
  });

  it("reverses a composed index declaration from query shape", () => {
    mockAssetMetadata({});

    const query: MangoQuery = {
      selector: {
        "??table": "assets",
        owner: "alice",
        createdAt: { $gt: "2026-01-01" },
      },
      sort: [{ createdAt: "asc" }],
    };

    const suggestion = reverseRequiredShapeToIndexDeclaration(Asset, query);

    expect(suggestion.attribute).toBe("owner");
    expect(suggestion.compositions).toEqual(["createdAt"]);
    expect(suggestion.name).toBe("assets_owner_createdAt_asc_index");
    expect(suggestion.decorator).toContain("@index");
    expect(suggestion.decorator).toContain("createdAt");
  });

  it("throws an actionable IndexPlanningError when a strict generated index is missing", () => {
    mockAssetMetadata({});

    const query: MangoQuery = {
      selector: {
        "??table": "assets",
        owner: "alice",
        createdAt: { $gt: "2026-01-01" },
      },
      sort: [{ createdAt: "asc" }],
    };

    expect(() => requireGeneratedUseIndex(Asset, query, undefined)).toThrow(
      IndexPlanningError
    );

    try {
      requireGeneratedUseIndex(Asset, query, undefined);
    } catch (error) {
      const planningError = error as IndexPlanningError;
      expect(planningError.message).toContain("@index");
      expect(planningError.message).toContain("owner");
      expect(planningError.message).toContain("createdAt");
      expect(planningError.message).toContain("assets_owner_createdAt_asc_index");
      expect(planningError.suggestion.expectedName).toBe(
        "assets_owner_createdAt_asc_index"
      );
    }
  });
});
