import { BaseModel, Condition, Operator, pk, table } from "@decaf-ts/core";
import { model } from "@decaf-ts/decorator-validation";
import { CouchDBStatement } from "../../../src/query/Statement";

@table("gtin_exists_model")
@model()
class GtinExistsModel extends BaseModel {
  @pk({ type: String })
  productCode!: string;

  nickname?: string;
}

describe("CouchDBStatement EXISTS translation", () => {
  it("maps a field-level EXISTS condition to a $exists selector", () => {
    const statement = new CouchDBStatement({} as any);
    (statement as any).fromSelector = GtinExistsModel;

    const query = (statement as any).parseCondition(
      Condition.attribute<GtinExistsModel>("nickname").exists()
    );

    expect(query.selector).toEqual({ nickname: { $exists: true } });
  });

  it("maps EXISTS to $exists for a primary key attribute too", () => {
    const statement = new CouchDBStatement({} as any);
    (statement as any).fromSelector = GtinExistsModel;

    const query = (statement as any).parseCondition(
      Condition.attribute<GtinExistsModel>("productCode").exists()
    );

    expect(query.selector).toEqual({ productCode: { $exists: true } });
  });

  it("uses the CouchDB EXISTS operator constant", () => {
    expect(Operator.EXISTS).toBe("EXISTS");
    const statement = new CouchDBStatement({} as any);
    (statement as any).fromSelector = GtinExistsModel;

    const query = (statement as any).parseCondition(
      Condition.attribute<GtinExistsModel>("nickname").exists()
    );

    expect(query.selector.nickname).toHaveProperty("$exists", true);
  });

  it("maps a negated field-level EXISTS condition to a $exists:false selector", () => {
    const statement = new CouchDBStatement({} as any);
    (statement as any).fromSelector = GtinExistsModel;

    const query = (statement as any).parseCondition(
      Condition.attribute<GtinExistsModel>("nickname").exists(false)
    );

    expect(query.selector).toEqual({ nickname: { $exists: false } });
  });

  it("maps a negated EXISTS to $exists:false for a primary key attribute too", () => {
    const statement = new CouchDBStatement({} as any);
    (statement as any).fromSelector = GtinExistsModel;

    const query = (statement as any).parseCondition(
      Condition.attribute<GtinExistsModel>("productCode").exists(false)
    );

    expect(query.selector).toEqual({ productCode: { $exists: false } });
  });

  it("combines a negated EXISTS leg with a positive EXISTS leg", () => {
    const statement = new CouchDBStatement({} as any);
    (statement as any).fromSelector = GtinExistsModel;

    const query = (statement as any).parseCondition(
      Condition.attribute<GtinExistsModel>("nickname")
        .exists(false)
        .and(Condition.attribute<GtinExistsModel>("productCode").exists())
    );

    expect(query.selector).toEqual({
      $and: [
        { nickname: { $exists: false } },
        { productCode: { $exists: true } },
      ],
    });
  });
});
