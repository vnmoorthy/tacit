const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c: Crypto | undefined = (globalThis as any).crypto;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(out);
  } else {
    for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

/** Short, URL-safe, sortable-enough ids: <prefix>_<10 chars>. */
export function newId(prefix: string): string {
  const bytes = randomBytes(10);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `${prefix}_${s}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
