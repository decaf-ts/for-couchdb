import {
  NoPopulateManyModel,
  NoPopulateOnceModel,
  testAddress,
  TestAddressModel,
  testCountry,
  TestCountryModel,
  TestDummyCountry,
  TestDummyPhone,
  testPhone,
  TestPhoneModel,
  testUser,
  TestUserModel,
} from "./models";
import { Model } from "@decaf-ts/decorator-validation";
import { ServerScope } from "nano";
import { CouchDBAdapter, wrapDocumentScope } from "../../src";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { Condition, Repository } from "@decaf-ts/core";
import { Sequence as Seq } from "../../src/";
import { sequenceNameForModel } from "@decaf-ts/core";

const admin = "couchdb.admin";
const admin_password = "couchdb.admin";
const user = "couchdb.admin";
const user_password = "couchdb.admin";
const dbName = "complex_db";
const dbHost = "localhost:10010";

Model.setBuilder(Model.fromModel);

jest.setTimeout(500000);

describe(`Complex Database`, function () {
  let con: ServerScope;
  let adapter: CouchDBAdapter;

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
  });

  afterAll(async () => {
    await CouchDBAdapter.deleteDatabase(con, dbName);
  });

  let seqManager: Repository<Seq>;
  let userManager: Repository<TestUserModel>;
  let phoneManager: Repository<TestPhoneModel>;
  let addressManager: Repository<TestAddressModel>;
  let countryManager: Repository<TestCountryModel>;
  let noPopulateOnceManager: Repository<NoPopulateOnceModel>;
  let noPopulateManyManager: Repository<NoPopulateManyModel>;

  let model: any;

  beforeAll(async () => {
    seqManager = Repository.forModel(Seq);
    expect(seqManager).toBeDefined();

    userManager = new Repository(adapter, TestUserModel);
    phoneManager = new Repository(adapter, TestPhoneModel);
    addressManager = new Repository(adapter, TestAddressModel);
    countryManager = new Repository(adapter, TestCountryModel);
    noPopulateOnceManager = new Repository(adapter, NoPopulateOnceModel);
    noPopulateManyManager = new Repository(adapter, NoPopulateManyModel);

    model = {
      name: "test country",
      countryCode: "tst",
      locale: "ts_TS",
    };
  });

  describe("basic test", () => {
    let cached: TestCountryModel;

    it("creates a new record", async () => {
      const record = new TestCountryModel(model);
      const created = await countryManager.create(record);
      expect(created).toBeDefined();
      expect(created.equals(record, "createdOn", "updatedOn", "id")).toEqual(
        true
      );
      expect(created.id).toEqual(1);
      cached = created;
    });

    it("updates the sequences", async () => {
      const modelSequence = await seqManager.read(
        sequenceNameForModel(cached, "pk")
      );
      expect(modelSequence).toBeDefined();
      expect(modelSequence.id).toEqual(TestCountryModel.name + "_pk");
      expect(modelSequence.current).toEqual(1);
    });

    it("reads a record", async () => {
      const read = await countryManager.read(1);
      expect(read).toBeDefined();
      expect(read.equals(cached)).toEqual(true);
    });

    it("updates a record", async () => {
      const toUpdate = new TestCountryModel(
        Object.assign({}, cached, {
          name: "other test name",
        })
      );
      const updated = await countryManager.update(toUpdate);
      const read = await countryManager.read(1);
      expect(read).toBeDefined();
      expect(read.name).toEqual("other test name");
      expect(read.equals(updated)).toEqual(true);
      cached = read;
    });

    it("finds a record", async () => {
      const condition = Condition.attribute("name").eq("other test name");
      const results: TestCountryModel[] = await countryManager
        .select()
        .where(condition)
        .execute<TestCountryModel[]>();
      expect(results).toBeDefined();
      expect(results.length).toEqual(1);
      expect(cached.equals(results[0])).toEqual(true);
    });

    it("deletes a record", async () => {
      const deleted = await countryManager.delete(1);
      await expect(countryManager.read(1)).rejects.toBeInstanceOf(
        NotFoundError
      );
      expect(deleted.equals(cached)).toEqual(true);
    });
  });

  describe.skip("Complex relations Test", () => {
    describe("One to one relations", () => {
      let created: TestAddressModel;
      let updated: TestAddressModel;

      it("Ensure no population when populate is disabled in a one-to-one relation", async () => {
        const country = {
          name: "test country",
          countryCode: "tst",
          locale: "ts_TS",
        };

        const address = new NoPopulateOnceModel({ country });
        const created = await noPopulateOnceManager.create(address);
        expect(created.country).toEqual("1");

        const read = await noPopulateOnceManager.read(`${created.id}`);
        expect(read.country).toEqual("1");

        created.country = new TestDummyCountry({
          name: "foo",
          countryCode: "foo",
          locale: "fo_FO",
        });
        const updated = await noPopulateOnceManager.update(created);
        expect(updated.country).toEqual("2");

        const deleted = await noPopulateOnceManager.delete(`${created.id}`);
        expect(deleted.country).toEqual("2");
      });

      it("Creates a one to one relation", async () => {
        const address = new TestAddressModel({
          street: "test street",
          doorNumber: "test door",
          apartmentNumber: "test number",
          areaCode: "test area code",
          city: "test city",
          country: model,
        });
        created = (await addressManager.create(address)) as TestAddressModel;

        const addressSeq = await seqManager.read(TestAddressModel.name);
        expect(addressSeq.current).toEqual("1");
        const countrySeq = await seqManager.read(TestCountryModel.name);
        expect(countrySeq.current).toEqual("1");

        testAddress(created);

        const read = (await addressManager.read(
          created.id
        )) as TestAddressModel;
        testAddress(read);
        expect(created.equals(read)).toEqual(true);
        expect(created.country?.equals(read.country)).toEqual(true);

        const read2 = (await countryManager.read(
          created.country.id
        )) as TestCountryModel;
        testCountry(read2);
        expect(read2.equals(created.country)).toEqual(true);
      });

      it("Updates a one to one relation", async () => {
        const address = new TestAddressModel(
          Object.assign({}, created, {
            city: "test city2",
            country: new TestCountryModel(
              Object.assign({}, created.country, {
                name: "other name",
              })
            ),
          })
        );
        updated = await addressManager.update(address);
        testAddress(updated);

        const read = await addressManager.read(updated.id);
        testAddress(read);
        expect(updated.equals(read)).toEqual(true);
        expect(updated.country.equals(read.country)).toEqual(true);

        const read2 = (await countryManager.read(
          created.country.id
        )) as TestCountryModel;
        testCountry(read2);
        expect(read2.equals(updated.country)).toEqual(true);
      });

      it("Deletes a one to one relation", async () => {
        const deleted = await addressManager.delete(updated.id);
        testAddress(deleted);
        await expect(addressManager.read(updated.id)).rejects.toBeInstanceOf(
          NotFoundError
        );
        await expect(
          countryManager.read(updated.country.id)
        ).rejects.toBeInstanceOf(NotFoundError);
      });

      it("Creates another to check sequences", async () => {
        const address = new TestAddressModel({
          street: "test street",
          doorNumber: "test door",
          apartmentNumber: "test number",
          areaCode: "test area code",
          city: "test city",
          country: model,
        });
        created = (await addressManager.create(address)) as TestAddressModel;

        expect(created.id).toEqual("2");
        expect(created.country.id).toEqual("2");

        const addressSeq = await seqManager.read(TestAddressModel.name);
        expect(addressSeq.current).toEqual("2");
        const countrySeq = await seqManager.read(TestCountryModel.name);
        expect(countrySeq.current).toEqual("2");
      });
    });

    describe("One to many relations", () => {
      const user = {
        name: "testuser",
        email: "test@test.com",
        age: 25,
        address: {
          street: "test street",
          doorNumber: "test door",
          apartmentNumber: "test number",
          areaCode: "test area code",
          city: "test city",
          country: {
            name: "test country",
            countryCode: "tst",
            locale: "ts_TS",
          },
        },
        phones: [
          {
            areaCode: "351",
            number: "000-0000000",
          },
          {
            areaCode: "351",
            number: "000-0000001",
          },
        ],
      };

      let created: TestUserModel;
      let updated: TestUserModel;

      it("Ensure no population when populate is disabled in a one-to-many relation", async () => {
        const phones = [
          {
            areaCode: "351",
            number: "000-0000000",
          },
          {
            areaCode: "351",
            number: "000-0000001",
          },
        ];

        const created = await noPopulateManyManager.create(
          new NoPopulateManyModel({
            name: "Robert",
            phones: phones,
          })
        );
        expect(created.phones).toEqual(["1", "2"]);

        const read = await noPopulateManyManager.read(`${created.id}`);
        expect(read.phones).toEqual(["1", "2"]);

        read.phones = [
          new TestDummyPhone({
            areaCode: "352",
            number: "000-0000002",
          }),
          new TestDummyPhone({
            areaCode: "51",
            number: "000-0000000",
          }),
        ];
        const updated = await noPopulateManyManager.update(read);
        expect(updated.phones).toEqual(["3", "4"]);

        const deleted = await noPopulateManyManager.delete(`${created.id}`);
        expect(deleted.phones).toEqual(["3", "4"]);
      });

      it("Creates a one to many relation", async () => {
        created = await userManager.create(new TestUserModel(user));

        const userSeq = await seqManager.read(TestUserModel.name);
        expect(userSeq.current).toEqual("1");

        const v = TestAddressModel.name;
        const addressSeq = await seqManager.read(v);
        expect(addressSeq.current).toEqual("3");

        const countrySeq = await seqManager.read(TestCountryModel.name);
        expect(countrySeq.current).toEqual("3");

        const phoneSeq = await seqManager.read(TestPhoneModel.name);
        expect(phoneSeq.current).toEqual("2");

        testUser(created);

        const read = await userManager.read(created.id);
        testUser(read);

        const { address, phones } = read;
        expect(created.equals(read)).toEqual(true);
        expect(created.address.equals(address)).toEqual(true);

        const read2 = await addressManager.read(created.address.id);
        testAddress(read2);
        expect(read2.equals(created.address)).toEqual(true);

        const read3 = await countryManager.read(address.country.id);
        testCountry(read3);
        expect(read3.equals(address.country)).toEqual(true);
        phones.forEach((p: any) => {
          testPhone(p);
        });
      });

      it("Updates a one to many relation", async () => {
        // created = await userManager.create(new TestUserModel(user));
        const toUpdate = new TestUserModel(
          Object.assign({}, created, {
            name: "new name",
            address: Object.assign({}, created.address, {
              city: "new city",
              country: Object.assign({}, created.address?.country, {
                name: "new country",
              }),
            }),
            phones: [
              Object.assign({}, (created.phones as any[])[0], {
                areaCode: "352",
              }),
              Object.assign({}, (created.phones as any[])[1], {
                areaCode: "352",
              }),
            ],
          })
        );
        updated = await userManager.update(toUpdate);
        testUser(updated);

        const read = await userManager.read(updated.id);
        testUser(read);
        expect(read.name).toEqual("new name");

        const { address, phones } = read;
        expect(updated.equals(read)).toEqual(true);
        expect(updated.address.equals(address)).toEqual(true);
        const read2 = await addressManager.read(updated.address.id);
        testAddress(read2);
        expect(read2.city).toEqual("new city");
        expect(read2.equals(updated.address)).toEqual(true);

        const read3 = await countryManager.read(address.country.id);
        testCountry(read3);
        expect(read3.equals(address.country)).toEqual(true);
        expect(read3.name).toEqual("new country");

        phones.forEach((p: any) => {
          testPhone(p);
          expect(p.areaCode).toEqual("352");
        });
      });

      it("Deletes a one to many relation", async () => {
        const deleted = await userManager.delete(updated.id);
        testUser(deleted);
        await expect(
          addressManager.read(updated.address.id)
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          countryManager.read(updated.address.country.id)
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          phoneManager.read((updated.phones as any)[0].id)
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          phoneManager.read((updated.phones as any)[1].id)
        ).rejects.toBeInstanceOf(NotFoundError);
      });
    });

    describe("Validate a key populate", () => {
      it("In a one-to-one relation", async () => {
        const country = await countryManager.create(
          new TestCountryModel({
            name: "Portugal",
            countryCode: "pt",
            locale: "pt_PT",
          })
        );

        const address = new TestAddressModel({
          street: "5th Avenue",
          doorNumber: "517",
          apartmentNumber: "NA",
          areaCode: "646e",
          city: "New York",
          country: country?.id || -1,
        });
        const created = await addressManager.create(address);

        expect(created.country).toEqual(expect.objectContaining(country));

        testAddress(created);

        const readAddress = await addressManager.read(created.id);
        testAddress(readAddress);
        expect(created.equals(readAddress)).toEqual(true);
        expect(created.country?.equals(readAddress.country)).toEqual(true);

        const readCountry = (await countryManager.read(
          created.country.id
        )) as TestCountryModel;
        testCountry(readCountry);
        expect(readCountry.equals(created.country)).toEqual(true);
      });

      it("In a one-to-many relation", async () => {
        const country = await countryManager.create(
          new TestCountryModel({
            name: "Italy",
            countryCode: "it",
            locale: "it_IT",
          })
        );

        const phone1 = await phoneManager.create(
          new TestPhoneModel({
            areaCode: "51",
            number: "510 899000010",
          })
        );

        const phone2 = await phoneManager.create(
          new TestPhoneModel({
            areaCode: "59",
            number: "059 901000900",
          })
        );

        const phoneIds = [phone1.id, phone2.id];

        const user = new TestUserModel({
          name: "Ronald",
          email: "ronald@test.com",
          age: 36,
          address: {
            street: "New avenue",
            doorNumber: "414e4",
            apartmentNumber: "404",
            areaCode: "51",
            city: "New Desert City",
            country: country.id,
          },
          phones: phoneIds,
        });

        const created: TestUserModel = await userManager.create(user);

        expect(created?.address?.country).toEqual(
          expect.objectContaining(country)
        );

        expect((created?.phones || [])[0]).toEqual(
          expect.objectContaining(phone1)
        );
        expect((created?.phones || [])[1]).toEqual(
          expect.objectContaining(phone2)
        );

        testUser(created);

        const read = await userManager.read(created.id);
        testUser(read);

        const { address, phones } = read;
        expect(created.equals(read)).toEqual(true);
        expect(created.address?.equals(address)).toEqual(true);

        const read2 = await addressManager.read(created.address.id);
        testAddress(read2);
        expect(read2.equals(created.address)).toEqual(true);

        const read3 = await countryManager.read(address.country.id);
        testCountry(read3);
        expect(read3.equals(address?.country)).toEqual(true);
        phones.forEach((p: any) => {
          testPhone(p);
        });
      });

      it("Populate should fail when all elements do not match the same type", async () => {
        const country = await countryManager.create(
          new TestCountryModel({
            name: "Spain",
            countryCode: "es",
            locale: "es_ES",
          })
        );

        const phone1 = await phoneManager.create(
          new TestPhoneModel({
            areaCode: "49",
            number: "490 899000010",
          })
        );

        const phoneIds = [
          phone1.id,
          {
            areaCode: "63",
            number: "063 96310009",
          },
        ];

        const user = new TestUserModel({
          name: "Ronald",
          email: "ronald@test.com",
          age: 36,
          address: {
            street: "New avenue",
            doorNumber: "414e4",
            apartmentNumber: "404",
            areaCode: "51",
            city: "New Desert City",
            country: country.id,
          },
          phones: phoneIds,
        });

        let created: any = undefined;
        try {
          created = await userManager.create(user);
        } catch (e: any) {
          expect(e?.message).toContain(
            "Invalid operation. All elements of property phones must match the same type."
          );
        }
        expect(created).toBeUndefined();
      });
    });
  });
});
