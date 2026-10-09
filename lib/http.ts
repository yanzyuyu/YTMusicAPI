import type { IncomingMessage, ServerResponse } from "node:http";

export interface StandardRequest extends IncomingMessage {
  query?: Record<string, string>;
}

export interface StandardResponse extends ServerResponse {
  status?: (code: number) => StandardResponse;
  json?: (data: unknown) => void;
  redirect?: (statusOrUrl: number | string, url?: string) => void;
}

export function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
}

export function parseQuery(req: IncomingMessage): Record<string, string> {
  const customReq = req as StandardRequest;
  if (customReq.query) {
    return customReq.query;
  }
  const urlStr = req.url || "/";
  try {
    const parsed = new URL(urlStr, "http://localhost");
    const result: Record<string, string> = {};
    parsed.searchParams.forEach((val, key) => {
      result[key] = val;
    });
    return result;
  } catch {
    return {};
  }
}

export function sendJson(res: StandardResponse, statusCode: number, data: unknown): void {
  setCorsHeaders(res);
  if (typeof res.status === "function" && typeof res.json === "function") {
    const s = res.status(statusCode);
    if (s && typeof s.json === "function") {
      s.json(data);
      return;
    }
  }
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

export function sendError(
  res: StandardResponse,
  statusCode: number,
  message: string,
  code: string = "ERR_BAD_REQUEST"
): void {
  sendJson(res, statusCode, {
    error: message,
    code
  });
}

export function redirect(res: StandardResponse, url: string, statusCode: number = 302): void {
  setCorsHeaders(res);
  if (typeof res.redirect === "function") {
    res.redirect(statusCode, url);
    return;
  }
  res.writeHead(statusCode, {
    Location: url
  });
  res.end();
}
