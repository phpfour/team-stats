// HMAC-SHA256 signing using Web Crypto. Runs in Workers and Node 20+.

const enc = new TextEncoder();

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  const b = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return b.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sign(value: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return `${value}.${toBase64Url(sig)}`;
}

export async function verify(
  signed: string,
  secret: string,
): Promise<string | null> {
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const expected = await sign(value, secret);
  // constant-time-ish: compare full strings of equal length
  if (expected.length !== signed.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signed.charCodeAt(i);
  }
  return mismatch === 0 ? value : null;
}
