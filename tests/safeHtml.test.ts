import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSafeImageMarkup,
  normalizeHttpHref,
  sanitizeStoredImageMarkup,
} from "../src/safeHtml";
import { linkifyText } from "../src/linkify";

const PNG_DATA_URL = "data:image/png;base64,aGVsbG8=";

test("sanitizeStoredImageMarkup rebuilds image markup and strips active HTML", () => {
  const unsafeMarkup = [
    '<div class="image-container" onclick="alert(1)">',
    `<img src="${PNG_DATA_URL}" onerror="alert(2)" style="width: 123px; background: url(javascript:alert(3))">`,
    "<script>alert(4)</script>",
    "</div>",
  ].join("");

  const sanitized = sanitizeStoredImageMarkup(unsafeMarkup);

  assert.match(sanitized, /class="image-container"/);
  assert.match(sanitized, /class="inserted-image resizable"/);
  assert.match(sanitized, /width: 123px/);
  assert.doesNotMatch(sanitized, /onerror|onclick|script|javascript:/i);
});

test("sanitizeStoredImageMarkup rejects executable image sources", () => {
  assert.equal(sanitizeStoredImageMarkup('<img src="javascript:alert(1)">'), "");
  assert.equal(
    sanitizeStoredImageMarkup('<img src="data:image/svg+xml;base64,PHN2Zz4=">'),
    "",
  );
});

test("buildSafeImageMarkup keeps only supported data image types", () => {
  assert.notEqual(buildSafeImageMarkup(PNG_DATA_URL), "");
  assert.equal(buildSafeImageMarkup("https://example.com/image.png"), "");
});

test("sanitizeStoredImageMarkup preserves image width after round trip", () => {
  const original = buildSafeImageMarkup(PNG_DATA_URL, 180);

  assert.match(sanitizeStoredImageMarkup(original), /width: 180px/);
});

test("normalizeHttpHref only allows http and https schemes", () => {
  assert.equal(normalizeHttpHref("file:///C:/Windows/win.ini"), null);
  assert.equal(normalizeHttpHref("javascript:alert(1)"), null);
  assert.equal(normalizeHttpHref("www.example.com"), "https://www.example.com/");
  assert.equal(normalizeHttpHref("https://example.com/path"), "https://example.com/path");
});

test("linkifyText sanitizes persisted image HTML before restoring it", () => {
  const html = [
    "before",
    '<div class="image-container" onclick="alert(1)">',
    `<img src="${PNG_DATA_URL}" onerror="alert(2)" style="width: 88px">`,
    "</div>",
    "after",
  ].join("\n");

  const linked = linkifyText(html);

  assert.match(linked, /class="image-container"/);
  assert.match(linked, /width: 88px/);
  assert.doesNotMatch(linked, /onclick|onerror|javascript:/i);
});

test("linkifyText leaves unsupported schemes as escaped text", () => {
  const linked = linkifyText("file:///C:/Windows/win.ini javascript:alert(1)");

  assert.doesNotMatch(linked, /<a /);
  assert.match(linked, /file:\/\/\/C:\/Windows\/win.ini/);
});
