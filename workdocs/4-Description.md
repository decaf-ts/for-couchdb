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
