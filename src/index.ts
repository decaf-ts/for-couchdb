import { Metadata } from "@decaf-ts/decoration";

export * from "./indexes";
export * from "./repository";
export * from "./adapter";
export * from "./constants";
export * from "./errors";
export * from "./metadata";
export * from "./decorators";
export * from "./types";
export * from "./utils";
export * from "./query";
export * from "./views";

/**
 * @description CouchDB adapter for Decaf.ts
 * @summary A TypeScript adapter for CouchDB database operations, providing a seamless integration with the Decaf.ts framework. This module includes classes, interfaces, and utilities for working with CouchDB databases, including support for Mango queries, document operations, and sequence management.
 * @module for-couchdb
 */

/**
 * @description Stores the current package version
 * @summary The version string of the for-couchdb package
 * @const VERSION
 */
export const VERSION = "##VERSION##";

/**
 * @description Represents the current commit hash of the module build.
 * @summary Stores the current git commit hash for the package. The build replaces
 * the placeholder with the actual commit hash at publish time.
 * @const COMMIT
 */
export const COMMIT = "##COMMIT##";

/**
 * @description Represents the full version string of the module.
 * @summary Stores the semver version and commit hash for the package.
 * The build replaces the placeholder with the actual `<version>-<commit>` value at publish time.
 * @const FULL_VERSION
 */
export const FULL_VERSION = "##FULL_VERSION##";


/**
 * @description Stores the current package name
 * @summary The version string of the for-couchdb package
 * @const PACKAGE_NAME
 */
export const PACKAGE_NAME = "##PACKAGE##";

Metadata.registerLibrary(PACKAGE_NAME, VERSION);
