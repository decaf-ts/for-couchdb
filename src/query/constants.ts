import { MangoOperator } from "../types";

/**
 * @description Default query limit for CouchDB queries
 * @summary Maximum number of documents to return in a single query
 * @const CouchDBQueryLimit
 * @memberOf module:for-couchdb
 */
export const CouchDBQueryLimit = 250;

/**
 * @description Mapping of operator names to CouchDB Mango query operators
 * @summary Constants for CouchDB comparison operators used in Mango queries
 * @typedef {Object} CouchDBOperatorType
 * @property {string} EQUAL - Equality operator ($eq)
 * @property {string} DIFFERENT - Inequality operator ($ne)
 * @property {string} BIGGER - Greater than operator ($gt)
 * @property {string} BIGGER_EQ - Greater than or equal operator ($gte)
 * @property {string} SMALLER - Less than operator ($lt)
 * @property {string} SMALLER_EQ - Less than or equal operator ($lte)
 * @property {string} NOT - Negation operator ($not)
 * @property {string} IN - In array operator ($in)
 * @property {string} REGEXP - Regular expression operator ($regex)
 * @const CouchDBOperator
 * @type {CouchDBOperatorType}
 * @memberOf module:for-couchdb
 */
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

/**
 * @description Mapping of logical operator names to CouchDB Mango query operators
 * @summary Constants for CouchDB logical operators used in Mango queries
 * @typedef {Object} CouchDBGroupOperatorType
 * @property {string} AND - Logical AND operator ($and)
 * @property {string} OR - Logical OR operator ($or)
 * @const CouchDBGroupOperator
 * @type {CouchDBGroupOperatorType}
 * @memberOf module:for-couchdb
 */
export const CouchDBGroupOperator: Record<string, MangoOperator> = {
  AND: "$and",
  OR: "$or",
};

/**
 * @description Special constant values used in CouchDB queries
 * @summary String constants representing special values in CouchDB
 * @typedef {Object} CouchDBConstType
 * @property {string} NULL - String representation of null value
 * @const CouchDBConst
 * @type {CouchDBConstType}
 * @memberOf module:for-couchdb
 */
export const CouchDBConst: Record<string, string> = {
  NULL: "null",
};
