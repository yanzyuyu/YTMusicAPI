import test from "node:test";
import assert from "node:assert/strict";
import routerHandler from "../api/index.js";
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

test("router handles OPTIONS preflight globally", async () => {
  const req = { method: "OPTIONS", url: "/api/search" } as IncomingMessage;
  const res = new MockResponse();

  await routerHandler(req, res as unknown as ServerResponse);
  assert.equal(res.statusCode, 204);
});

test("router returns 404 for unknown api routes", async () => {
  const req = { method: "GET", url: "/api/unknown-endpoint" } as IncomingMessage;
  const res = new MockResponse();

  await routerHandler(req, res as unknown as ServerResponse);
  assert.equal(res.statusCode, 404);

  const payload = JSON.parse(res.body);
  assert.ok(payload.error.includes("not found"));
  assert.equal(payload.code, "ERR_NOT_FOUND");
});

test("router routes /api/health directly to health handler", async () => {
  const req = { method: "GET", url: "/api/health" } as IncomingMessage;
  const res = new MockResponse();

  await routerHandler(req, res as unknown as ServerResponse);
  assert.equal(res.statusCode, 200);

  const payload = JSON.parse(res.body);
  assert.equal(payload.status, "ok");
  assert.equal(payload.engine, "ytmusic-native");
});
