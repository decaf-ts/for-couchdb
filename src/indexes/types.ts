import { OrderDirection } from "@decaf-ts/core";

export type Index = {
  index: {
    fields: string[] | { [k: string]: OrderDirection };
  };
  ddoc?: string;
  name: string;
  type: "json";
};
