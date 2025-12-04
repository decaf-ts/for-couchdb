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

## Release Documentation Hooks
Stay aligned with the automated release pipeline by reviewing [Release Notes](./workdocs/reports/RELEASE_NOTES.md) and [Dependencies](./workdocs/reports/DEPENDENCIES.md) after trying these recipes (updated on 2025-11-26).
