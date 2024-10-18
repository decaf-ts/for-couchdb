import {BaseModel, Condition, pk, Repository, uses} from "@decaf-ts/core";
import {min, minlength, Model, model, ModelArg, required, type} from "@decaf-ts/decorator-validation";
import {ServerScope} from "nano";
import {CouchDBAdapter, wrapDocumentScope} from "../../src";
import {ConflictError, readonly} from "@decaf-ts/db-decorators";
import {CouchDBRepository} from "../../src/interfaces";


const admin="couchdb.admin";
const admin_password="couchdb.admin";
const user="couchdb.admin";
const user_password="couchdb.admin";
const dbName="queries_db";
const dbHost="localhost:10010";

Model.setBuilder(Model.fromModel)

jest.setTimeout(50000)

describe("Queries", () => {

  let con: ServerScope;
  let adapter: CouchDBAdapter;

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

  @uses("nano")
  @model()
  class TestUser extends BaseModel {
    @pk({type: "Number"})
    id?: number = undefined;

    @required()
    @min(18)
    age?: number = undefined;

    @required()
    @minlength(5)
    name?: string = undefined;

    @required()
    @readonly()
    @type([String.name])
    sex?: "M" | "F" = undefined

    constructor(arg?: ModelArg<TestUser>) {
      super(arg);
    }
  }

  let created: TestUser[];

  it("Creates in bulk", async () => {
    const repo: CouchDBRepository<TestUser> = Repository.forModel<TestUser, CouchDBRepository<TestUser>>(TestUser);
    const models = [1,2,3,4,5,6,7,8,9,10]
      .map(i => new TestUser({
        age: Math.floor(18 + (i - 1)/3),
        name: "user_name_" + i,
        sex: i % 2 === 0 ? "M" : "F"
      }))
    created = await repo.createAll(models);
    expect(created).toBeDefined();
    expect(Array.isArray(created)).toEqual(true);
    expect(created.every(el => el instanceof TestUser)).toEqual(true)
    expect(created.every(el => !el.hasErrors())).toEqual(true)
  })

  it("Performs simple queries - full object", async () => {
    const repo: CouchDBRepository<TestUser> = Repository.forModel<TestUser, CouchDBRepository<TestUser>>(TestUser);
    const selected = await repo.select().execute<TestUser[]>();
    expect(created.every((c, i) => c.equals(selected.find(s => s.id = c.id))))
  })

  it("Performs simple queries - attributes only", async () => {
    const repo: CouchDBRepository<TestUser> = Repository.forModel<TestUser, CouchDBRepository<TestUser>>(TestUser);
    const selected = await repo.select(["age", "sex"]).execute<{age: number, sex: "M" | "F"}[]>();
    expect(selected).toEqual(expect.arrayContaining([...new Array(created.length)].map(e => expect.objectContaining({age: expect.any(Number), sex: expect.stringMatching(/^M|F$/g)}))))
  })

  it("Performs conditional queries - full object", async () => {
    const repo: CouchDBRepository<TestUser> = Repository.forModel<TestUser, CouchDBRepository<TestUser>>(TestUser);
    const condition = Condition.attribute("age").eq(20);
    const selected = await repo.select().where(condition).execute<TestUser[]>();
    expect(selected.length).toEqual(created.filter(c => c.age === 20).length);
  })

  it("Performs conditional queries - selected attributes", async () => {
    const repo: CouchDBRepository<TestUser> = Repository.forModel<TestUser, CouchDBRepository<TestUser>>(TestUser);
    const condition = Condition.attribute("age").eq(20);
    const selected = await repo.select(["age", "sex"]).where(condition).execute<TestUser[]>();
    expect(selected.length).toEqual(created.filter(c => c.age === 20).length);
    expect(selected).toEqual(expect.arrayContaining([...new Array(created.length)].map(e => expect.objectContaining({age: expect.any(Number), sex: expect.stringMatching(/^M|F$/g)}))))
  })

  it("Performs AND conditional queries - full object", async () => {
    const repo: CouchDBRepository<TestUser> = Repository.forModel<TestUser, CouchDBRepository<TestUser>>(TestUser);
    const condition = Condition.attribute("age").eq(20).and(Condition.attribute("sex").eq("M"));
    const selected = await repo.select().where(condition).execute<TestUser[]>();
    expect(selected.length).toEqual(created.filter(c => c.age === 20 && c.sex === "M").length);
  })

})