import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, GithubError } from "./client";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(impl: (url: string, init?: RequestInit) => Response) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    impl(typeof input === "string" ? input : input.toString(), init),
  ) as typeof fetch;
}

describe("github client", () => {
  it("graphql posts to /graphql with auth + returns data", async () => {
    mockFetch((url, init) => {
      expect(url).toBe("https://api.github.com/graphql");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer tkn");
      expect(headers["User-Agent"]).toBe("github-stats");
      const body = JSON.parse(init!.body as string);
      expect(body.query).toContain("query");
      expect(body.variables).toEqual({ x: 1 });
      return new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
    });
    const c = makeClient("tkn");
    const data = await c.graphql<{ ok: boolean }>("query { x }", { x: 1 });
    expect(data.ok).toBe(true);
  });

  it("graphql throws GithubError on http failure", async () => {
    mockFetch(() => new Response("nope", { status: 502 }));
    const c = makeClient("tkn");
    await expect(c.graphql("query {}")).rejects.toBeInstanceOf(GithubError);
  });

  it("graphql throws on errors[]", async () => {
    mockFetch(
      () => new Response(JSON.stringify({ errors: [{ message: "bad" }] }), { status: 200 }),
    );
    const c = makeClient("tkn");
    await expect(c.graphql("query {}")).rejects.toThrow(/graphql errors/);
  });

  it("rest hits the v3 base by default", async () => {
    mockFetch((url) => {
      expect(url).toBe("https://api.github.com/repos/klasio/api/commits");
      return new Response(JSON.stringify([{ sha: "abc" }]), { status: 200 });
    });
    const c = makeClient("tkn");
    const data = await c.rest<Array<{ sha: string }>>("/repos/klasio/api/commits");
    expect(data).toEqual([{ sha: "abc" }]);
  });
});
