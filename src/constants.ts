/**
 * @description Regular expression to identify reserved attributes in CouchDB
 * @summary Matches any attribute that starts with an underscore
 * @const reservedAttributes
 * @memberOf module:for-couchdb
 */
export const reservedAttributes = /^_.*$/g;

/**
 * @description Key constants used in CouchDB operations
 * @summary Collection of string constants for CouchDB document properties and operations
 * @typedef {Object} CouchDBKeysType
 * @property {string} SEPARATOR - Separator used for combining table name and ID
 * @property {string} ID - CouchDB document ID field
 * @property {string} REV - CouchDB document revision field
 * @property {string} DELETED - CouchDB deleted document marker
 * @property {string} TABLE - Table name marker
 * @property {string} SEQUENCE - Sequence marker
 * @property {string} DDOC - Design document marker
 * @property {string} NATIVE - Native marker
 * @property {string} INDEX - Index marker
 * @memberOf module:for-couchdb
 */

/**
 * @description Key constants used in CouchDB operations
 * @summary Collection of string constants for CouchDB document properties and operations
 * @const CouchDBKeys
 * @type {CouchDBKeysType}
 * @memberOf module:for-couchdb
 */
export const CouchDBKeys = {
  SEPARATOR: "__",
  ID: "_id",
  REV: "_rev",
  DELETED: "_deleted",
  TABLE: "??table",
  SEQUENCE: "??sequence",
  DDOC: "ddoc",
  NATIVE: "__native",
  INDEX: "index",
};
