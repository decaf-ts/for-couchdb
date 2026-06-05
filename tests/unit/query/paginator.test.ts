import { BaseModel } from "@decaf-ts/core";
import { Model } from "@decaf-ts/decorator-validation";
import { Metadata } from "@decaf-ts/decoration";
import { CouchDBPaginator } from "../../../src/query/Paginator";
import { MangoQuery } from "../../../src/types";

class User extends BaseModel {
  constructor() {
    super();
  }
}

describe("CouchDBPaginator", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("pages with bookmarks instead of full counts and skip", async () => {
    jest.spyOn(Model, "pk").mockReturnValue("id" as any);
    jest.spyOn(Metadata, "get").mockReturnValue({ type: undefined } as any);

    const log = {
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const adapter = {
      logCtx: jest.fn(() => ({
        log,
        ctxArgs: [],
        ctx: {},
        for: () => ({ log, ctxArgs: [], ctx: {} }),
      })),
      raw: jest
        .fn()
        .mockResolvedValueOnce({
          docs: [{ id: "u1" }, { id: "u2" }],
          bookmark: "bm1",
          execution_stats: {
            total_keys_examined: 2,
            total_docs_examined: 2,
            total_quorum_docs_examined: 0,
            results_returned: 2,
            execution_time_ms: 4,
          },
        })
        .mockResolvedValueOnce({
          docs: [{ id: "u3" }],
          warning: "using bookmark",
        }),
    } as any;

    const query: MangoQuery = {
      selector: { "??table": "users" },
      fields: ["id"],
      skip: 42,
    };

    const paginator = new CouchDBPaginator(adapter, query, 2, User);

    const firstPage = await paginator.page(1);
    const secondPage = await paginator.page(2);

    expect(firstPage).toEqual([{ id: "u1" }, { id: "u2" }]);
    expect(secondPage).toEqual([{ id: "u3" }]);
    expect(adapter.raw).toHaveBeenCalledTimes(2);

    const firstCallStatement = adapter.raw.mock.calls[0][0];
    const secondCallStatement = adapter.raw.mock.calls[1][0];

    expect(firstCallStatement.limit).toBe(2);
    expect(firstCallStatement.skip).toBeUndefined();
    expect(firstCallStatement.bookmark).toBeUndefined();
    expect(secondCallStatement.limit).toBe(2);
    expect(secondCallStatement.skip).toBeUndefined();
    expect(secondCallStatement.bookmark).toBe("bm1");
    expect(
      (adapter.raw.mock.calls as Array<[Record<string, unknown>]>).some(
        ([statement]) => statement.limit === Number.MAX_SAFE_INTEGER
      )
    ).toBe(false);
    expect(log.debug).toHaveBeenCalledWith(
      expect.stringContaining("Mango execution stats")
    );
    expect(log.warn).toHaveBeenCalledWith("using bookmark");
  });
});
