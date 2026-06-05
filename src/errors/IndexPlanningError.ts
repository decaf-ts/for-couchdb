import { IndexError } from "./IndexError";

export type IndexPlanningSuggestion = {
  modelName: string;
  tableName: string;
  attribute: string;
  compositions: string[];
  directions: string[];
  expectedName: string;
  expectedDdoc: string;
  expectedFields: Array<string | Record<string, string>>;
  decorator: string;
};

export class IndexPlanningError extends IndexError {
  readonly suggestion: IndexPlanningSuggestion;
  readonly query: unknown;

  constructor(
    message: string,
    suggestion: IndexPlanningSuggestion,
    query: unknown
  ) {
    super(message);
    this.name = "IndexPlanningError";
    this.suggestion = suggestion;
    this.query = query;
  }
}
