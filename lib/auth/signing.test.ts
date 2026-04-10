import { describe, it, expect } from "vitest";
import { sign, verify } from "./signing";

const SECRET = "test-secret-do-not-use-in-prod";

describe("signing", () => {
  it("round-trips a value", async () => {
    const signed = await sign("hello", SECRET);
    expect(await verify(signed, SECRET)).toBe("hello");
  });

  it("rejects a tampered value", async () => {
    const signed = await sign("hello", SECRET);
    const tampered = signed.replace("hello", "world");
    expect(await verify(tampered, SECRET)).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const signed = await sign("hello", SECRET);
    const tampered = signed.slice(0, -1) + (signed.slice(-1) === "a" ? "b" : "a");
    expect(await verify(tampered, SECRET)).toBeNull();
  });

  it("rejects a value signed with a different secret", async () => {
    const signed = await sign("hello", SECRET);
    expect(await verify(signed, "other-secret")).toBeNull();
  });

  it("rejects a value with no signature delimiter", async () => {
    expect(await verify("nodelimiter", SECRET)).toBeNull();
  });
});
