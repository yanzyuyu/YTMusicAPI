import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/health.js";
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

test("health endpoint returns 204 for OPTIONS preflight", async () => {
  const req = { method: "OPTIONS" } as IncomingMessage;
  const res = new MockResponse();

  await handler(req, res as unknown as ServerResponse);
  assert.equal(res.statusCode, 204);
});

test("health endpoint returns 200 with ok status and version metadata", async () => {
  const req = { method: "GET" } as IncomingMessage;
  const res = new MockResponse();

  await handler(req, res as unknown as ServerResponse);
  assert.equal(res.statusCode, 200);

  const payload = JSON.parse(res.body);
  assert.equal(payload.status, "ok");
  assert.equal(payload.engine, "ytmusic-native");
  assert.equal(payload.version, "1.0.0");
  assert.equal(typeof payload.uptimeSeconds, "number");
  assert.ok(payload.timestamp);
});
