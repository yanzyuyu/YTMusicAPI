import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const terminalLines = [
  { type: "prompt", text: "$ curl -s http://localhost:3000/api/health | jq ." },
  { type: "json", text: "{" },
  { type: "json", text: '  "status": "ok",' },
  { type: "json", text: '  "uptimeSeconds": 1420,' },
  { type: "json", text: '  "engine": "ytmusic-native",' },
  { type: "json", text: '  "version": "1.0.0"' },
  { type: "json", text: "}" },
  { type: "blank", text: "" },
  { type: "prompt", text: '$ curl -s "http://localhost:3000/api/lyrics?title=Faded&artist=Alan+Walker" | jq .syncedLyrics[0]' },
  { type: "json", text: "{" },
  { type: "json", text: '  "time": 11.14,' },
  { type: "json", text: '  "text": "You were the shadow to my light"' },
  { type: "json", text: "}" },
  { type: "blank", text: "" },
  { type: "prompt", text: '$ curl -I "http://localhost:3000/api/stream?id=DlFXDl_ROAM&play=true"' },
  { type: "header", text: "HTTP/1.1 302 Found" },
  { type: "header", text: "Access-Control-Allow-Origin: *" },
  { type: "header", text: "Location: https://rr1---sn-n8v7knzs.googlevideo.com/videoplayback?expire=1729605..." },
  { type: "blank", text: "" },
  { type: "prompt", text: "$ npm test" },
  { type: "success", text: "✔ health endpoint returns 200 with ok status (0.6ms)" },
  { type: "success", text: "✔ parseLrc parses standard timestamp format (1.2ms)" },
  { type: "success", text: "✔ cleanSearchTitle removes video/audio decorators (0.5ms)" },
  { type: "success", text: "✔ redirect sets Location header and 302 status code (0.2ms)" },
  { type: "info", text: "ℹ tests 15 | pass 15 | fail 0 | duration_ms 78ms" }
];

const width = 840;
const lineHeight = 20;
const topOffset = 64;
const paddingX = 24;
const height = terminalLines.length * lineHeight + topOffset + 30;

let textElements = "";
let currentY = topOffset + lineHeight;

for (const line of terminalLines) {
  if (line.type === "blank") {
    currentY += lineHeight;
    continue;
  }

  let color = "#c9d1d9";
  let weight = "normal";

  if (line.type === "prompt") {
    color = "#58a6ff";
    weight = "bold";
  } else if (line.type === "json") {
    color = "#79c0ff";
  } else if (line.type === "header") {
    color = "#f2cc60";
  } else if (line.type === "success") {
    color = "#7ee787";
  } else if (line.type === "info") {
    color = "#d2a8ff";
    weight = "bold";
  }

  const escaped = escapeHtml(line.text);
  textElements += `    <text x="${paddingX}" y="${currentY}" fill="${color}" font-weight="${weight}">${escaped}</text>\n`;
  currentY += lineHeight;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1117" />
      <stop offset="100%" stop-color="#161b22" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.6" />
    </filter>
  </defs>

  <rect width="${width}" height="${height}" rx="12" fill="url(#bg_grad)" stroke="#30363d" stroke-width="1.5" filter="url(#shadow)" />

  <path d="M 0 12 C 0 5.373 5.373 0 12 0 L ${width - 12} 0 C ${width - 5.373} 0 ${width} 5.373 ${width} 12 L ${width} 44 L 0 44 Z" fill="#161b22" />
  <line x1="0" y1="44" x2="${width}" y2="44" stroke="#30363d" stroke-width="1" />

  <circle cx="22" cy="22" r="6" fill="#ff5f56" stroke="#e0443e" stroke-width="0.5" />
  <circle cx="42" cy="22" r="6" fill="#ffbd2e" stroke="#dea123" stroke-width="0.5" />
  <circle cx="62" cy="22" r="6" fill="#27c93f" stroke="#1aab29" stroke-width="0.5" />

  <text x="${width / 2}" y="26" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" font-weight="600" text-anchor="middle">bash — ytmusic-player-api v1.0.0 (production execution)</text>

  <g font-family="'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace" font-size="12.5" xml:space="preserve">
${textElements}  </g>
</svg>`;

const outputPath = resolve("terminal_demo.svg");
writeFileSync(outputPath, svg, "utf-8");
