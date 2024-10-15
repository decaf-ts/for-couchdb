export const reservedAttributes = /^_.*$/g;

export const CouchDBKeys: Record<string, string> = {
  SEPARATOR: "_",
  ID: "_id",
  REV: "_rev",
  TABLE: "??table",
};
