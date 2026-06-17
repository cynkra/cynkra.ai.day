import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "@/middleware";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/", { headers });
}

describe("middleware request-id", () => {
  it("preserves a valid client-supplied request id", () => {
    const request = makeRequest({
      "x-request-id": "abc12345-6789-4def-8123-456789abcdef",
    });
    const response = middleware(request);
    expect(response.headers.get("x-request-id")).toBe(
      "abc12345-6789-4def-8123-456789abcdef",
    );
  });

  it("generates a new request id when the client did not send one", () => {
    const request = makeRequest();
    const response = middleware(request);
    const id = response.headers.get("x-request-id");
    expect(id).toBeTruthy();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("generates a new request id when the client sent a malformed value", () => {
    const request = makeRequest({ "x-request-id": "bad value with spaces" });
    const response = middleware(request);
    const id = response.headers.get("x-request-id");
    expect(id).not.toBe("bad value with spaces");
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("generates a new id when the value is too short", () => {
    const request = makeRequest({ "x-request-id": "short" });
    const response = middleware(request);
    expect(response.headers.get("x-request-id")).not.toBe("short");
  });
});
