export function nextLexicographicString(value: string): string {
  if (!value) return "\u0000";
  if (/^\d+$/.test(value)) {
    const chars = value.split("");
    let i = chars.length - 1;
    while (i >= 0 && chars[i] === "9") {
      chars[i] = "0";
      i -= 1;
    }
    if (i < 0) return `1${chars.join("")}`;
    chars[i] = String.fromCharCode(chars[i].codePointAt(0)! + 1);
    return chars.join("");
  }
  const chars = Array.from(value);
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const code = chars[i].codePointAt(0);
    if (code === undefined) continue;
    if (code < 0x10ffff) {
      chars[i] = String.fromCodePoint(code + 1);
      return chars.slice(0, i + 1).join("");
    }
  }
  return `${value}\u0000`;
}

export function prefixRange(prefix: string) {
  return {
    start: prefix,
    end: nextLexicographicString(prefix),
  };
}
