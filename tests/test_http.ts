import test from "node:test";
import assert from "node:assert/strict";
import { setCorsHeaders, parseQuery, sendJson, sendError, redirect } from "../lib/http.js";
import type { IncomingMessage, ServerResponse } from "node:http";

class MockResponse {
  headers: Record<string, string> = {};
  statusCode: number = 200;
  body: string = "";

  setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }

  writeHead(statusCode: number, headers?: Record<string, string | number>): void {
    this.statusCode = statusCode;
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        this.headers[key.toLowerCase()] = String(value);
      }
    }
  }

  end(content?: string): void {
    if (content) {
      this.body = content;
    }
  }
}

test("setCorsHeaders applies mandatory security headers", () => {
  const res = new MockResponse();
  setCorsHeaders(res as unknown as ServerResponse);

  assert.equal(res.headers["access-control-allow-origin"], "*");
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["x-frame-options"], "SAMEORIGIN");
});

test("parseQuery parses query params from URL string", () => {
  const req = {
    url: "/api/search?q=test+query&type=songs&limit=10"
  } as IncomingMessage;

  const query = parseQuery(req);
  assert.equal(query.q, "test query");
  assert.equal(query.type, "songs");
  assert.equal(query.limit, "10");
});

test("parseQuery handles malformed or empty URLs", () => {
  const req = { url: "" } as IncomingMessage;
  const query = parseQuery(req);
  assert.deepEqual(query, {});
});

test("sendJson writes correct json and length header", () => {
  const res = new MockResponse();
  sendJson(res as unknown as ServerResponse, 200, { status: "ok", count: 42 });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "application/json; charset=utf-8");
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.count, 42);
});

test("sendError writes structured error payload", () => {
  const res = new MockResponse();
  sendError(res as unknown as ServerResponse, 400, "Missing required parameter");

  assert.equal(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.error, "Missing required parameter");
  assert.equal(parsed.code, "ERR_BAD_REQUEST");
});

test("redirect sets Location header and 302 status code", () => {
  const res = new MockResponse();
  redirect(res as unknown as ServerResponse, "https://example.com/audio.webm", 302);

  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, "https://example.com/audio.webm");
  assert.equal(res.headers["access-control-allow-origin"], "*");
});
