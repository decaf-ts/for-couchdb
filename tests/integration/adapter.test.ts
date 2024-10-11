import {CouchDBAdapter} from "../../src/adapter";
import {ServerScope} from "nano";
import {PersistenceKeys, Repository} from "@decaf-ts/core";
import {Model} from "@decaf-ts/decorator-validation";
import {TestModel} from "../TestModel";
import {wrapDocumentScope} from "../../src";
import {ConflictError, NotFoundError} from "@decaf-ts/db-decorators";

const admin="couchdb.admin";
const admin_password="couchdb.admin";
const user="couchdb.admin";
const user_password="couchdb.admin";
const dbName="test_db";
const dbHost="localhost:10010";

Model.setBuilder(Model.fromModel);

jest.setTimeout(50000)

describe("Adapter Integration", () => {

  let con: ServerScope;
  let repo: Repository<TestModel>;

  beforeAll(async () => {
    con = await CouchDBAdapter.connect(admin, admin_password, dbHost);
    expect(con).toBeDefined();
    try {
      await CouchDBAdapter.createDatabase(con, dbName);
      await CouchDBAdapter.createUser(con, dbName, user, user_password);
    } catch (e: any) {
      if (!(e instanceof ConflictError))
        throw e;
    }
    con = await CouchDBAdapter.connect(user, user_password, dbHost);
    repo = new Repository<TestModel>(new CouchDBAdapter(wrapDocumentScope(con, dbName, user, user_password), "nano"), TestModel);
  })

  afterAll(async () => {
    // await CouchDBAdapter.deleteDatabase(con, dbName);
  })


  let created: TestModel, updated: TestModel;

  it("creates", async () => {
    const model = new TestModel({
      id: Date.now().toString(),
      name: "test_name",
      nif: "123456789"
    });

    created = await repo.create(model);

    expect(created).toBeDefined();
    const metadata = (created as any)[PersistenceKeys.METADATA]
    expect(metadata).toBeDefined();
  })

  it("reads", async () => {

    const read = await repo.read(created.id as string);

    expect(read).toBeDefined();
    expect(read.equals(created)).toEqual(true); // same model
    expect(read === created).toEqual(false); // different instances
    const metadata = (read as any)[PersistenceKeys.METADATA]
    expect(metadata).toBeDefined();
  })

  it("updates", async () => {

    const toUpdate = new TestModel(Object.assign({}, created, {
      name: "new_test_name"
    }))

    updated = await repo.update(toUpdate);

    expect(updated).toBeDefined();
    expect(updated.equals(created)).toEqual(false);
    expect(updated.equals(created, "updatedOn", "name")).toEqual(true); // minus the expected changes
    const metadata = (updated as any)[PersistenceKeys.METADATA]
    expect(metadata).toBeDefined();
  })

  it("deletes", async () => {
    const deleted = await repo.delete(created.id as string);
    expect(deleted).toBeDefined();
    expect(deleted.equals(updated)).toEqual(true);

    await expect(repo.read(created.id as string)).rejects.toThrowError(NotFoundError)

    const metadata = (deleted as any)[PersistenceKeys.METADATA]
    expect(metadata).toBeDefined();
  })
})