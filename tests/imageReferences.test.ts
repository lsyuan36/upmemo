import assert from "node:assert/strict";
import test from "node:test";
import { linkifyText } from "../src/linkify";
import { findActualImageContainerTokens } from "../src/htmlImageTokens";
import { buildSafeImageMarkup, sanitizeStoredImageMarkup } from "../src/safeHtml";

const IMAGE_ID = `${"a".repeat(64)}.png`;
const PNG_DATA_URL = "data:image/png;base64,aGVsbG8=";

test("Given a controlled image ID, when persisted markup is sanitized, then it keeps only the ID and width", () => {
  const markup = [
    '<div class="image-container" onclick="alert(1)">',
    `<img data-upmemo-image="${IMAGE_ID}" src="asset://runtime/image.png" onerror="alert(2)" style="width: 180px; background: url(javascript:alert(3))">`,
    "</div>",
  ].join("");

  const sanitized = sanitizeStoredImageMarkup(markup);

  assert.match(sanitized, new RegExp(`data-upmemo-image="${IMAGE_ID}"`));
  assert.match(sanitized, /width: 180px/);
  assert.doesNotMatch(sanitized, /\bsrc=|asset:|onclick|onerror|javascript:/i);
});

test("Given a controlled image ID, when safe markup is built, then it has no runtime src", () => {
  const serialized = buildSafeImageMarkup(IMAGE_ID, 240);

  assert.match(serialized, new RegExp(`data-upmemo-image="${IMAGE_ID}"`));
  assert.match(serialized, /width: 240px/);
  assert.doesNotMatch(serialized, /\bsrc=/i);
});

test("Given a supported controlled image extension, when safe markup is built, then it is retained", () => {
  for (const extension of ["png", "jpg", "gif"] as const) {
    const imageReference = `${"b".repeat(64)}.${extension}`;

    assert.match(
      buildSafeImageMarkup(imageReference),
      new RegExp(`data-upmemo-image="${imageReference}"`),
    );
  }
});

test("Given persisted controlled image markup, when linkified, then it does not restore the runtime URL", () => {
  const linked = linkifyText(
    `<img data-upmemo-image="${IMAGE_ID}" src="asset://runtime/image.png">`,
  );

  assert.match(linked, new RegExp(`data-upmemo-image="${IMAGE_ID}"`));
  assert.doesNotMatch(linked, /\bsrc=|asset:/i);
});

test("Given a legacy safe Data URL, when persisted markup is sanitized, then it remains readable", () => {
  const sanitized = sanitizeStoredImageMarkup(
    `<img src="${PNG_DATA_URL}" style="width: 180px">`,
  );

  assert.match(sanitized, new RegExp(`src="${PNG_DATA_URL}"`));
  assert.match(sanitized, /width: 180px/);
});

test("Given an invalid persisted image reference, when sanitized, then it is removed", () => {
  const unsafeMarkup = [
    '<img data-upmemo-image="../secret.png">',
    '<img data-upmemo-image="/absolute/image.png">',
    '<img data-upmemo-image="C:\\images\\image.png">',
    '<img data-upmemo-image="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.png">',
    '<img src="file:///C:/Windows/win.ini">',
    '<img src="asset://arbitrary/image.png">',
    '<img src="https://example.com/image.png">',
    '<img src="data:image/svg+xml;base64,PHN2Zz4=">',
    `<img data-upmemo-image="asset://${IMAGE_ID}">`,
  ];

  for (const markup of unsafeMarkup) {
    assert.equal(sanitizeStoredImageMarkup(markup), "", markup);
  }
});

test("Given image-reference attribute smuggling, when sanitized, then only an exact single img attribute is accepted", () => {
  const conflictingImageId = `${"b".repeat(64)}.png`;
  const smuggledMarkup = [
    `<img aria-data-upmemo-image="${IMAGE_ID}" src="asset://runtime/image.png">`,
    `<img x-data-upmemo-image="${IMAGE_ID}" src="asset://runtime/image.png">`,
    `<img data-upmemo-image-extra="${IMAGE_ID}" src="asset://runtime/image.png">`,
    `<div data-upmemo-image="${IMAGE_ID}"><img src="asset://runtime/image.png"></div>`,
    `<img data-upmemo-image="${IMAGE_ID}" data-upmemo-image="${conflictingImageId}">`,
    `<img src="${PNG_DATA_URL}" src="asset://runtime/image.png">`,
    `<div><img src="asset://runtime/image.png"><span data-upmemo-image="${IMAGE_ID}"></span></div>`,
    `<img src="asset://runtime/image.png"><div data-upmemo-image="${IMAGE_ID}">`,
  ];

  for (const markup of smuggledMarkup) {
    assert.equal(sanitizeStoredImageMarkup(markup), "", markup);
  }
});

test("Given inert image-like markup, when sanitized or linkified, then it is never promoted to an image", () => {
  const inertMarkup = [
    `<!-- <img data-upmemo-image="${IMAGE_ID}"> -->`,
    `<script>const template = '<img data-upmemo-image="${IMAGE_ID}">';</script>`,
    `<style>.preview::before { content: '<img data-upmemo-image="${IMAGE_ID}">'; }</style>`,
    `<textarea><img data-upmemo-image="${IMAGE_ID}"></textarea>`,
    `<title><img data-upmemo-image="${IMAGE_ID}"></title>`,
    `<div data-template='<img data-upmemo-image="${IMAGE_ID}">'>plain text</div>`,
  ];

  for (const markup of inertMarkup) {
    assert.equal(sanitizeStoredImageMarkup(markup), "", markup);
    assert.doesNotMatch(linkifyText(markup), /class="image-container"/, markup);
  }
});

test("Given actual and inert image-like markup, when linkified, then only the actual image is canonicalized", () => {
  const linked = linkifyText(
    `<!-- <img data-upmemo-image="${IMAGE_ID}"> --><img data-upmemo-image="${IMAGE_ID}" src="asset://runtime/image.png"><script>'<img data-upmemo-image="${IMAGE_ID}">'</script>`,
  );

  assert.equal(linked.match(/class="image-container"/g)?.length, 1);
  assert.doesNotMatch(linked, /asset:|\bsrc=/i);
});

test("Given malformed tokenizer contexts, when linkified, then only closed inert contexts recover to a later image", () => {
  const actualImage = `<img data-upmemo-image="${IMAGE_ID}" src="asset://runtime/image.png">`;
  const cases = [
    { markup: `<div data-template='${actualImage}${actualImage}`, images: 0 },
    { markup: `<div data-template="${actualImage}${actualImage}`, images: 0 },
    { markup: `<script data-template='${actualImage}${actualImage}`, images: 0 },
    { markup: `<script data-template="${actualImage}${actualImage}`, images: 0 },
    { markup: `<?instruction ${actualImage}`, images: 0 },
    { markup: `<?instruction?>${actualImage}`, images: 1 },
    { markup: `<![CDATA[${actualImage}`, images: 0 },
    { markup: `<![CDATA[${actualImage}]]>${actualImage}`, images: 1 },
    { markup: `<!broken ${actualImage}`, images: 0 },
    { markup: `<!broken>${actualImage}`, images: 1 },
  ];

  for (const testCase of cases) {
    assert.equal(
      linkifyText(testCase.markup).match(/class="image-container"/g)?.length ?? 0,
      testCase.images,
      testCase.markup,
    );
  }
});

test("Given a large malformed quoted tag, when linkified, then it terminates without promoting nested images", () => {
  const malformed = `<div data-template='${"x".repeat(100_000)}<img data-upmemo-image="${IMAGE_ID}">`;

  assert.doesNotMatch(linkifyText(malformed), /class="image-container"/);
});

test("Given exact and nested image containers, when linkified, then only outer exact containers serialize once", () => {
  const image = `<img data-upmemo-image="${IMAGE_ID}">`;
  const linked = linkifyText(`<div class="image-container"><div class="image-container">${image}</div></div><div class="image-container">${image}</div>`);
  assert.equal(linked.match(/class="image-container"/g)?.length, 2);
  for (const markup of [`<div aria-class="image-container">${image}</div>`, `<div class="not-image-container">${image}</div>`, `<div class="image-container-extra">${image}</div>`]) {
    assert.match(linkifyText(markup), /^&lt;div /);
  }
});

test("Given actual container ranges, when tokenized and linkified, then siblings and inert prefixes stay bounded", () => {
  const image = `<img data-upmemo-image="${IMAGE_ID}" onclick="alert(1)">`;
  const first = `<div data-id="one" class="pane image-container">${image}</div>`;
  const second = `<div class="image-container">${image}</div>`;
  const mixed = `<!-- ${first} -->${first}${second}`;
  assert.equal(findActualImageContainerTokens(mixed).length, 2);
  const linked = linkifyText(mixed);
  assert.equal(linked.match(/class="image-container"/g)?.length, 2);
  assert.equal(linked.match(/ onclick="/g)?.length ?? 0, 0);
});
