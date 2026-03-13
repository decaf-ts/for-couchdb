import { Constructor } from "@decaf-ts/decoration";
import { Model } from "@decaf-ts/decorator-validation";
import {
  ComposedFromMetadata,
  DefaultSeparator,
  PrimaryKeyType,
} from "@decaf-ts/db-decorators";
import { CouchDBKeys } from "../constants";

export function reconstructPrimaryKeyFromIdParts<M extends Model>(
  clazz: Constructor<M>,
  pkAttr: keyof M,
  keyArgs: string[]
): string | undefined {
  if (!keyArgs.length) return undefined;
  const composed = Model.composed(
    clazz,
    pkAttr as keyof M
  ) as ComposedFromMetadata | undefined;
  if (!composed || composed.hashResult) {
    return keyArgs.join(CouchDBKeys.SEPARATOR);
  }
  const separator = composed.separator || DefaultSeparator;
  let value = keyArgs.join(separator);
  if (composed.prefix) value = `${composed.prefix}${value}`;
  if (composed.suffix) value = `${value}${composed.suffix}`;
  return value;
}

export function decomposePrimaryKeySegments<M extends Model>(
  clazz: Constructor<M>,
  pkAttr: keyof M,
  value: PrimaryKeyType
): string[] | undefined {
  const composed = Model.composed(
    clazz,
    pkAttr as keyof M
  ) as ComposedFromMetadata | undefined;
  if (!composed || composed.hashResult) return undefined;
  if (typeof value !== "string") return undefined;
  let current = value;
  if (composed.prefix && current.startsWith(composed.prefix)) {
    current = current.substring(composed.prefix.length);
  }
  if (composed.suffix && current.endsWith(composed.suffix)) {
    current = current.substring(0, current.length - composed.suffix.length);
  }
  if (!current.length) return [];
  const separator = composed.separator || DefaultSeparator;
  return current.split(separator);
}
