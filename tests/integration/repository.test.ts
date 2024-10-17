import {Model} from "@decaf-ts/decorator-validation";
import {ServerScope} from "nano";
import {CouchDBAdapter, wrapDocumentScope} from "../../src";
import {repository, Repository, uses} from "@decaf-ts/core";
import {TestModel} from "../TestModel";
import {ConflictError} from "@decaf-ts/db-decorators";


const admin="couchdb.admin";
const admin_password="couchdb.admin";
const user="couchdb.admin";
const user_password="couchdb.admin";
const dbName="repository_db";
const dbHost="localhost:10010";

Model.setBuilder(Model.fromModel);

jest.setTimeout(50000)

describe("repositories", () => {

  let con: ServerScope;
  let adapter: CouchDBAdapter;
  let repo: Repository<TestModel, any>;

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
    adapter = new CouchDBAdapter(wrapDocumentScope(con, dbName, user, user_password), "nano");
  })

  afterAll(async () => {
    await CouchDBAdapter.deleteDatabase(con, dbName);
  })

  it("instantiates via constructor", () => {
    const repo = new Repository(adapter, TestModel);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(Repository)
  })

  it("instantiates via Repository.get with @uses decorator on model", () => {
    uses("nano")(TestModel);
    const repo = Repository.forModel(TestModel)
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(Repository)
  })

  it("gets injected when using @repository", () => {
    class TestClass {
      @repository(TestModel)
      repo!: Repository<TestModel>
    }

    const testClass = new TestClass();
    expect(testClass).toBeDefined();
    expect(testClass.repo).toBeDefined();
    expect(testClass.repo).toBeInstanceOf(Repository)
  })


})