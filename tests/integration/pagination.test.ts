import { Model } from "@decaf-ts/decorator-validation";
import { ServerScope } from "nano";
import { CouchDBAdapter, wrapDocumentScope } from "../../src";
import { ConflictError, InternalError } from "@decaf-ts/db-decorators";
import { OrderDirection, Repository } from "@decaf-ts/core";
import { TestCountryModel } from "./models";

const admin = "couchdb.admin";
const admin_password = "couchdb.admin";
const user = "couchdb.admin";
const user_password = "couchdb.admin";
const dbName = "pagination_db";
const dbHost = "localhost:10010";

Model.setBuilder(Model.fromModel);

jest.setTimeout(500000);

describe(`Pagination`, function () {
  let con: ServerScope;
  let adapter: CouchDBAdapter;
  let repo: Repository<TestCountryModel>;

  let created: TestCountryModel[];
  const size = 100;

  beforeAll(async () => {
    con = await CouchDBAdapter.connect(admin, admin_password, dbHost);
    expect(con).toBeDefined();
    try {
      await CouchDBAdapter.createDatabase(con, dbName);
      await CouchDBAdapter.createUser(con, dbName, user, user_password);
    } catch (e: any) {
      if (!(e instanceof ConflictError)) throw e;
    }
    con = await CouchDBAdapter.connect(user, user_password, dbHost);
    adapter = new CouchDBAdapter(
      wrapDocumentScope(con, dbName, user, user_password),
      "nano"
    );
    repo = new Repository(adapter, TestCountryModel);
    const models = Object.keys(new Array(size).fill(0)).map(
      (i) =>
        new TestCountryModel({
          name: "country" + (parseInt(i) + 1),
          countryCode: "pt",
          locale: "pt_PT",
        })
    );

    created = await repo.createAll(models);
    expect(created).toBeDefined();
    expect(created.length).toEqual(size);
  });

  afterAll(async () => {
    await CouchDBAdapter.deleteDatabase(con, dbName);
  });

  let selected: TestCountryModel[];
  it.skip("Fails to sort in an unindexed property", async () => {
    await expect(
      repo
        .select()
        .orderBy(["id", OrderDirection.ASC])
        .execute<TestCountryModel[]>()
    ).rejects.toThrow(InternalError);
  });

  it("indexes de database properly according to defined indexes", async () => {
    await adapter.initialize();
  });

  it("Sorts via defined property when there is an index", async () => {
    selected = await repo
      .select()
      .orderBy(["id", OrderDirection.ASC])
      .execute<TestCountryModel[]>();
    expect(selected).toBeDefined();
    expect(selected.length).toEqual(created.length);
    expect(created.every((c, i) => c.equals(selected[i]))).toEqual(true);
  });

  it("paginates", async () => {
    const paginator = await repo.select().paginate<TestCountryModel>(10);

    expect(paginator).toBeDefined();

    expect(paginator.size).toEqual(10);
    expect(paginator.current).toEqual(undefined);

    const page1 = await paginator.page();
    expect(page1).toBeDefined();
    expect(page1).toEqual(
      expect.arrayContaining(
        created.slice((paginator.current - 1) * size, size)
      )
    );
  });
});
