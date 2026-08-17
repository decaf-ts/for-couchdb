import { BaseModel, Condition, pk, table } from "@decaf-ts/core";
import { model } from "@decaf-ts/decorator-validation";
import { CouchDBStatement } from "../../../src/query/Statement";
import { nextLexicographicString } from "../../../src/query/range";

@table("gtin_statement_model")
@model()
class GtinStatementModel extends BaseModel {
  @pk({ type: String })
  productCode!: string;
}

describe("CouchDBStatement", () => {
  it("advances a GTIN ending in 9 with carry", () => {
    expect(nextLexicographicString("98765432109879")).toBe("98765432109880");
    expect(nextLexicographicString("99999999999999")).toBe("100000000000000");
  });

  it("builds a numeric successor for starts-with prefixes ending in 9", () => {
    const statement = new CouchDBStatement({} as any);
    (statement as any).fromSelector = GtinStatementModel;

    const query = (statement as any).parseCondition(
      Condition.attribute<GtinStatementModel>("productCode").startsWith(
        "98765432109879"
      )
    );

    expect(query.selector.productCode.$gte).toBe("98765432109879");
    expect(query.selector.productCode.$lt).toBe("98765432109880");
  });

  it("keeps mixed alphanumeric prefixes lexicographic", () => {
    const statement = new CouchDBStatement({} as any);
    (statement as any).fromSelector = GtinStatementModel;

    const query = (statement as any).parseCondition(
      Condition.attribute<GtinStatementModel>("productCode").startsWith(
        "aaaaaaaaaaa0"
      )
    );

    expect(query.selector.productCode.$gte).toBe("aaaaaaaaaaa0");
    expect(query.selector.productCode.$lt).toBe("aaaaaaaaaaa1");
  });
});
