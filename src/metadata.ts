import { PersistenceKeys } from "@decaf-ts/core";
import { Model } from "@decaf-ts/decorator-validation";

export function setMetadata<M extends Model>(model: M, metadata: any) {
  Object.defineProperty(model, PersistenceKeys.METADATA, {
    enumerable: false,
    configurable: true,
    writable: true,
    value: metadata,
  });
}

export function getMetadata<M extends Model>(model: M) {
  const descriptor = Object.getOwnPropertyDescriptor(
    model,
    PersistenceKeys.METADATA
  );
  return descriptor ? descriptor.value : undefined;
}

export function removeMetadata<M extends Model>(model: M) {
  const descriptor = Object.getOwnPropertyDescriptor(
    model,
    PersistenceKeys.METADATA
  );
  if (descriptor) delete (model as any)[PersistenceKeys.METADATA];
}
