import { MangoOperator } from "nano";

export const CouchDBOperator: Record<string, MangoOperator> = {
  EQUAL: "$eq",
  DIFFERENT: "$ne",
  BIGGER: "$gt",
  BIGGER_EQ: "$gte",
  SMALLER: "$lt",
  SMALLER_EQ: "$lte",
  // BETWEEN = "BETWEEN",
  NOT: "$not",
  IN: "$in",
  // IS = "IS",
  REGEXP: "$regex",
};

export const CouchDBGroupOperator: Record<string, MangoOperator> = {
  AND: "$and",
  OR: "$or",
};

export const CouchDBConst: Record<string, string> = {
  NULL: "null",
};
