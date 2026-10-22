import test from "node:test";
import assert from "node:assert/strict";
import { parseLrc, cleanSearchTitle, cleanSearchArtist } from "../lib/lyrics.js";

test("parseLrc parses standard timestamp format", () => {
  const lrc = `
[00:11.14]You were the shadow to my light
[00:16.89]Did you feel us?
[00:20.50]Another start
  `;

  const parsed = parseLrc(lrc);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].time, 11.14);
  assert.equal(parsed[0].text, "You were the shadow to my light");
  assert.equal(parsed[1].time, 16.89);
  assert.equal(parsed[2].time, 20.5);
});

test("parseLrc handles empty or malformed text gracefully", () => {
  assert.deepEqual(parseLrc(""), []);
  assert.deepEqual(parseLrc("[ar: Alan Walker]\n[al: Faded]\nRandom unparsed line"), []);
});

test("cleanSearchTitle removes video and audio decorators", () => {
  assert.equal(cleanSearchTitle("Faded (Official Music Video)"), "Faded");
  assert.equal(cleanSearchTitle("Song Name [Official Audio]"), "Song Name");
  assert.equal(cleanSearchTitle("Track Title (Visualizer)"), "Track Title");
  assert.equal(cleanSearchTitle("Another Song (Lyrics)"), "Another Song");
  assert.equal(cleanSearchTitle("Hit Single (feat. Guest Artist)"), "Hit Single");
  assert.equal(cleanSearchTitle("Remastered Track - Remastered"), "Remastered Track");
});

test("cleanSearchArtist isolates primary artist and strips topic tags", () => {
  assert.equal(cleanSearchArtist("Alan Walker - Topic"), "Alan Walker");
  assert.equal(cleanSearchArtist("Artist One feat. Artist Two"), "Artist One");
  assert.equal(cleanSearchArtist("Lead Singer, Featured Vocalist"), "Lead Singer");
  assert.equal(cleanSearchArtist("DJ Producer & Co-Producer"), "DJ Producer");
});
