import { InternalError } from "@decaf-ts/db-decorators";

export function parseSequenceValue(
  type: "Number" | "BigInt" | undefined,
  value: string | number | bigint
): string | number | bigint {
  switch (type) {
    case "Number":
      return typeof value === "string"
        ? parseInt(value)
        : typeof value === "number"
          ? value
          : BigInt(value);
    case "BigInt":
      return BigInt(value);
    default:
      throw new InternalError("Should never happen");
  }
}
