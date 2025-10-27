![Banner](./workdocs/assets/decaf-logo.svg)

# Decaf CouchDB Module

A TypeScript adapter for CouchDB database operations, providing a seamless integration with the Decaf.ts framework. This module offers a comprehensive set of tools for working with CouchDB databases, including support for Mango queries, document operations, sequence management, and indexing capabilities.


![Licence](https://img.shields.io/github/license/decaf-ts/for-couchdb.svg?style=plastic)
![GitHub language count](https://img.shields.io/github/languages/count/decaf-ts/for-couchdb?style=plastic)
![GitHub top language](https://img.shields.io/github/languages/top/decaf-ts/for-couchdb?style=plastic)

[![Build & Test](https://github.com/decaf-ts/for-couchdb/actions/workflows/nodejs-build-prod.yaml/badge.svg)](https://github.com/decaf-ts/for-couchdb/actions/workflows/nodejs-build-prod.yaml)
[![CodeQL](https://github.com/decaf-ts/for-couchdb/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/decaf-ts/for-couchdb/actions/workflows/codeql-analysis.yml)[![Snyk Analysis](https://github.com/decaf-ts/for-couchdb/actions/workflows/snyk-analysis.yaml/badge.svg)](https://github.com/decaf-ts/for-couchdb/actions/workflows/snyk-analysis.yaml)
[![Pages builder](https://github.com/decaf-ts/for-couchdb/actions/workflows/pages.yaml/badge.svg)](https://github.com/decaf-ts/for-couchdb/actions/workflows/pages.yaml)
[![.github/workflows/release-on-tag.yaml](https://github.com/decaf-ts/for-couchdb/actions/workflows/release-on-tag.yaml/badge.svg?event=release)](https://github.com/decaf-ts/for-couchdb/actions/workflows/release-on-tag.yaml)

![Open Issues](https://img.shields.io/github/issues/decaf-ts/for-couchdb.svg)
![Closed Issues](https://img.shields.io/github/issues-closed/decaf-ts/for-couchdb.svg)
![Pull Requests](https://img.shields.io/github/issues-pr-closed/decaf-ts/for-couchdb.svg)
![Maintained](https://img.shields.io/badge/Maintained%3F-yes-green.svg)

![Line Coverage](workdocs/reports/coverage/badge-lines.svg)
![Function Coverage](workdocs/reports/coverage/badge-functions.svg)
![Statement Coverage](workdocs/reports/coverage/badge-statements.svg)
![Branch Coverage](workdocs/reports/coverage/badge-branches.svg)


![Forks](https://img.shields.io/github/forks/decaf-ts/for-couchdb.svg)
![Stars](https://img.shields.io/github/stars/decaf-ts/for-couchdb.svg)
![Watchers](https://img.shields.io/github/watchers/decaf-ts/for-couchdb.svg)

![Node Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fbadges%2Fshields%2Fmaster%2Fpackage.json&label=Node&query=$.engines.node&colorB=blue)
![NPM Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fbadges%2Fshields%2Fmaster%2Fpackage.json&label=NPM&query=$.engines.npm&colorB=purple)

Documentation available [here](https://decaf-ts.github.io/for-couchdb/)

### Description

The Decaf CouchDB Module is a versatile persistence layer designed to provide seamless integration between the Decaf.ts framework and CouchDB databases. It offers a comprehensive set of tools and abstractions that simplify working with CouchDB's unique features while maintaining type safety and following best practices.

#### Core Components

1. **CouchDBAdapter**: An abstract base class that provides the foundation for CouchDB database operations. It handles CRUD operations, sequence management, and error handling. Developers can extend this class to create custom adapters tailored to their specific needs.

2. **Query System**: A powerful query builder with support for CouchDB's Mango queries:
   - **CouchDBStatement**: Provides a fluent interface for building type-safe Mango queries
   - **CouchDBPaginator**: Implements pagination for query results using CouchDB's bookmark system
   - **Operator Translation**: Converts Decaf.ts core operators to CouchDB Mango operators

3. **Indexing**: Tools for creating and managing CouchDB indexes:
   - **Index Generation**: Automatically generates appropriate index configurations based on model metadata
   - **Index Management**: Utilities for creating and maintaining indexes

4. **Sequence Management**: A robust system for generating sequential IDs:
   - **CouchDBSequence**: Implements the Sequence interface for CouchDB
   - **Sequence Model**: Provides a data model for storing sequence information

5. **Error Handling**: Specialized error types and utilities for handling CouchDB-specific errors:
   - **Error Translation**: Converts CouchDB error codes and messages to appropriate Decaf.ts error types
   - **IndexError**: Specialized error for index-related issues

6. **Utilities**: Helper functions for common CouchDB operations:
   - **Authentication**: Functions for handling CouchDB authentication
   - **Connection Management**: Utilities for managing database connections
   - **Document Processing**: Tools for processing CouchDB documents

This module serves as a bridge between your application and CouchDB, abstracting away the complexities of the database while providing a type-safe, consistent API that integrates seamlessly with the rest of the Decaf.ts ecosystem.


### How to Use

- [Initial Setup](./workdocs/tutorials/For%20Developers.md#_initial-setup_)
- [Installation](./workdocs/tutorials/For%20Developers.md#installation)

## Creating a CouchDB Adapter

To use the CouchDB module, you need to create a concrete implementation of the CouchDBAdapter class:

```typescript
import { CouchDBAdapter } from '@decaf-ts/for-couchdb';
import { Constructor, Model } from '@decaf-ts/decorator-validation';
import { MangoQuery } from '@decaf-ts/for-couchdb';
import { generateIndexes } from '@decaf-ts/for-couchdb';
import * as nano from 'nano';

// Define your scope, flags, and context types
interface MyScope {
  config: {
    couchdb: {
      url: string;
      username: string;
      password: string;
      database: string;
    }
  }
}

class MyCouchDBAdapter extends CouchDBAdapter<MyScope, MyFlags, MyContext> {
  private db: any;

  constructor(scope: MyScope) {
    super(scope, 'my-couchdb', 'my-alias');

    // Initialize connection to CouchDB
    const { url, username, password, database } = scope.config.couchdb;
    const connection = nano(url);
    this.db = wrapDocumentScope(connection, database, username, password);
  }

  // Implement abstract methods
  async index<M extends Model>(...models: Constructor<M>[]): Promise<void> {
    const indexes = generateIndexes(models);
    for (const index of indexes) {
      try {
        await this.db.createIndex(index);
      } catch (error) {
        throw this.parseError(error);
      }
    }
  }

  async raw<R>(rawInput: MangoQuery, docsOnly: boolean): Promise<R> {
    try {
      const result = await this.db.find(rawInput);
      return docsOnly ? result.docs : result;
    } catch (error) {
      throw this.parseError(error);
    }
  }

  async create(tableName: string, id: string | number, model: Record<string, any>, ...args: any[]): Promise<Record<string, any>> {
    try {
      const result = await this.db.insert(model);
      return this.assignMetadata(model, result.rev);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  async read(tableName: string, id: string | number, ...args: any[]): Promise<Record<string, any>> {
    try {
      const docId = this.generateId(tableName, id);
      const doc = await this.db.get(docId);
      return this.assignMetadata(doc, doc._rev);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  async update(tableName: string, id: string | number, model: Record<string, any>, ...args: any[]): Promise<Record<string, any>> {
    try {
      const result = await this.db.insert(model);
      return this.assignMetadata(model, result.rev);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  async delete(tableName: string, id: string | number, ...args: any[]): Promise<Record<string, any>> {
    try {
      const docId = this.generateId(tableName, id);
      const doc = await this.db.get(docId);
      const result = await this.db.destroy(docId, doc._rev);
      return { id, _deleted: true };
    } catch (error) {
      throw this.parseError(error);
    }
  }
}
```

## Defining Models

Define your data models using the decorators from Decaf.ts:

```typescript
import { model, required, validate } from '@decaf-ts/decorator-validation';
import { BaseModel, pk, index, table } from '@decaf-ts/core';

@table('users')
@model()
export class User extends BaseModel {
  @pk()
  id!: string;

  @required()
  @index()
  email!: string;

  @required()
  firstName!: string;

  @required()
  lastName!: string;

  @index()
  age?: number;

  constructor(data?: Partial<User>) {
    super(data);
  }
}
```

## Creating a Repository

Create a repository for your model:

```typescript
import { Repository } from '@decaf-ts/core';
import { CouchDBRepository } from '@decaf-ts/for-couchdb';
import { User } from './models/User';
import { MyCouchDBAdapter } from './adapters/MyCouchDBAdapter';

// Get the adapter instance
const adapter = new MyCouchDBAdapter(myScope);

// Create a repository for the User model
const userRepository: CouchDBRepository<User, MyScope, MyFlags, MyContext> = 
  Repository.forModel(User, adapter.flavour);
```

## Basic CRUD Operations

Perform basic CRUD operations:

```typescript
// Create a new user
const newUser = new User({
  id: '123',
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  age: 30
});

// Create
const createdUser = await userRepository.create(newUser);

// Read
const user = await userRepository.read('123');

// Update
user.age = 31;
const updatedUser = await userRepository.update(user);

// Delete
await userRepository.delete('123');
```

## Using Statements for Queries

Build and execute queries using the Statement builder:

```typescript
import { Condition } from '@decaf-ts/core';

// Create a statement
const statement = adapter.Statement<User>();

// Build a query to find users older than 25, sorted by lastName
const users = await statement
  .from(User)
  .where(Condition.attribute<User>('age').gt(25))
  .orderBy('lastName', 'asc')
  .limit(10)
  .execute<User[]>();

// Query with multiple conditions
const johnDoes = await statement
  .from(User)
  .where(
    Condition.and(
      Condition.attribute<User>('lastName').eq('Doe'),
      Condition.attribute<User>('age').gt(18)
    )
  )
  .execute<User[]>();

// Select specific fields
const userEmails = await statement
  .from(User)
  .select(['email', 'firstName'])
  .where(Condition.attribute<User>('age').gt(25))
  .execute<Array<Pick<User, 'email' | 'firstName'>>>();
```

## Pagination

Paginate through query results:

```typescript
// Create a paginator
const paginator = await adapter
  .Statement<User>()
  .from(User)
  .where(Condition.attribute<User>('age').gt(18))
  .orderBy('lastName', 'asc')
  .paginate<User[]>(10); // 10 items per page

// Get the first page
const page1 = await paginator.page(1);

// Get the next page
const page2 = await paginator.page(2);
```

## Working with Sequences

Generate sequential IDs:

```typescript
import { SequenceOptions } from '@decaf-ts/core';

// Create a sequence
const sequenceOptions: SequenceOptions = {
  name: 'user-sequence',
  startWith: 1000,
  incrementBy: 1,
  type: 'Number'
};

const sequence = await adapter.Sequence(sequenceOptions);

// Get the next value
const nextId = await sequence.next();

// Get a range of values
const idRange = await sequence.range(5); // Returns 5 sequential IDs
```

## Index Management

Create and manage indexes:

```typescript
import { generateIndexDoc } from '@decaf-ts/for-couchdb';

// Generate an index configuration
const indexConfig = generateIndexDoc(
  'email',     // attribute
  'users',     // tableName
  ['firstName'], // compositions
  'asc'        // order
);

// Create the index
await adapter.db.createIndex(indexConfig);

// Initialize indexes for all models
await adapter.initialize();
```

## Error Handling

Handle CouchDB-specific errors:

```typescript
import { IndexError, ConflictError, NotFoundError } from '@decaf-ts/for-couchdb';

try {
  // Some operation that might fail
  await userRepository.read('non-existent-id');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.error('Document not found:', error.message);
  } else if (error instanceof ConflictError) {
    console.error('Document conflict:', error.message);
  } else if (error instanceof IndexError) {
    console.error('Index error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Raw Mango Queries

Execute raw Mango queries:

```typescript
import { MangoQuery } from '@decaf-ts/for-couchdb';

// Define a raw Mango query
const rawQuery: MangoQuery = {
  selector: {
    '??table': 'users',
    age: { $gt: 25 },
    lastName: { $eq: 'Doe' }
  },
  fields: ['_id', 'firstName', 'lastName', 'email'],
  sort: [{ lastName: 'asc' }],
  limit: 20
};

// Execute the raw query
const results = await adapter.raw(rawQuery, true);
```

## Utility Functions

Use utility functions for common operations:

```typescript
import { reAuth, wrapDocumentScope, generateIndexName } from '@decaf-ts/for-couchdb';

// Re-authenticate a connection
await reAuth(connection, 'username', 'password');

// Wrap a document scope with automatic re-authentication
const db = wrapDocumentScope(connection, 'my-database', 'username', 'password');

// Generate an index name
const indexName = generateIndexName('email', 'users', ['firstName'], 'asc');
```


## Coding Principles

- group similar functionality in folders (analog to namespaces but without any namespace declaration)
- one class per file;
- one interface per file (unless interface is just used as a type);
- group types as other interfaces in a types.ts file per folder;
- group constants or enums in a constants.ts file per folder;
- group decorators in a decorators.ts file per folder;
- always import from the specific file, never from a folder or index file (exceptions for dependencies on other packages);
- prefer the usage of established design patters where applicable:
  - Singleton (can be an anti-pattern. use with care);
  - factory;
  - observer;
  - strategy;
  - builder;
  - etc;


### Related

[![decaf-ts](https://github-readme-stats.vercel.app/api/pin/?username=decaf-ts&repo=decaf-ts)](https://github.com/decaf-ts/decaf-ts)
[![decorator-validation](https://github-readme-stats.vercel.app/api/pin/?username=decaf-ts&repo=for-fabric)](https://github.com/decaf-ts/for-fabric)
[![decorator-validation](https://github-readme-stats.vercel.app/api/pin/?username=decaf-ts&repo=for-nano)](https://github.com/decaf-ts/for-nano)
[![decorator-validation](https://github-readme-stats.vercel.app/api/pin/?username=decaf-ts&repo=for-pouch)](https://github.com/decaf-ts/for-pouch)
[![decorator-validation](https://github-readme-stats.vercel.app/api/pin/?username=decaf-ts&repo=core)](https://github.com/decaf-ts/core)
[![decorator-validation](https://github-readme-stats.vercel.app/api/pin/?username=decaf-ts&repo=decorator-validation)](https://github.com/decaf-ts/decorator-validation)
[![db-decorators](https://github-readme-stats.vercel.app/api/pin/?username=decaf-ts&repo=db-decorators)](https://github.com/decaf-ts/db-decorators)


### Social

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/decaf-ts/)




#### Languages

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![NodeJS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![ShellScript](https://img.shields.io/badge/Shell_Script-121011?style=for-the-badge&logo=gnu-bash&logoColor=white)

## Getting help

If you have bug reports, questions or suggestions please [create a new issue](https://github.com/decaf-ts/ts-workspace/issues/new/choose).

## Contributing

I am grateful for any contributions made to this project. Please read [this](./workdocs/98-Contributing.md) to get started.

## Supporting

The first and easiest way you can support it is by [Contributing](./workdocs/98-Contributing.md). Even just finding a typo in the documentation is important.

Financial support is always welcome and helps keep both me and the project alive and healthy.

So if you can, if this project in any way. either by learning something or simply by helping you save precious time, please consider donating.

## License

This project is released under the [Mozilla Public License 2.0](./LICENSE.md).

By developers, for developers...
