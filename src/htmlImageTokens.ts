const RAW_TEXT_TAG_NAMES = new Set(["script", "style", "textarea", "title"]);

export type ActualImageToken = {
  readonly start: number;
  readonly end: number;
  readonly markup: string;
};

export type ActualImageContainerToken = ActualImageToken;

type HtmlTagToken = {
  readonly name: string;
  readonly closing: boolean;
  readonly end: number;
  readonly markup: string;
  readonly attributes: readonly HtmlAttribute[];
};

type HtmlAttribute = { readonly name: string; readonly value: string };

type HtmlTagReadResult = HtmlTagToken | "unterminated" | null;

export function findActualImageTokens(markup: string): readonly ActualImageToken[] {
  return findActualMarkupTokens(markup).images;
}

export function findActualImageContainerTokens(
  markup: string,
): readonly ActualImageContainerToken[] {
  return findActualMarkupTokens(markup).containers;
}

function findActualMarkupTokens(markup: string): {
  readonly images: readonly ActualImageToken[];
  readonly containers: readonly ActualImageContainerToken[];
} {
  const images: ActualImageToken[] = [];
  const containers: ActualImageContainerToken[] = [];
  const divStack: Array<{ readonly start: number; readonly container: boolean; readonly imageContainer: boolean }> = [];
  let activeImageContainerDepth = 0;
  let position = 0;

  while (position < markup.length) {
    if (markup.startsWith("<!--", position)) {
      const commentEnd = markup.indexOf("-->", position + 4);
      if (commentEnd === -1) return { images, containers };

      position = commentEnd + 3;
      continue;
    }

    if (markup.startsWith("<?", position)) {
      const instructionEnd = markup.indexOf("?>", position + 2);
      if (instructionEnd === -1) return { images, containers };

      position = instructionEnd + 2;
      continue;
    }

    if (markup.startsWith("<![CDATA[", position)) {
      const cdataEnd = markup.indexOf("]]>", position + 9);
      if (cdataEnd === -1) return { images, containers };

      position = cdataEnd + 3;
      continue;
    }

    if (markup.startsWith("<!", position)) {
      const declarationEnd = markup.indexOf(">", position + 2);
      if (declarationEnd === -1) return { images, containers };

      position = declarationEnd + 1;
      continue;
    }

    if (markup.charAt(position) !== "<") {
      position += 1;
      continue;
    }

    const tag = readHtmlTag(markup, position);
    if (tag === "unterminated") return { images, containers };
    if (!tag) {
      position += 1;
      continue;
    }

    if (!tag.closing && RAW_TEXT_TAG_NAMES.has(tag.name)) {
      position = findRawTextEnd(markup, tag.end, tag.name);
      continue;
    }

    if (!tag.closing && tag.name === "img") {
      images.push({ start: position, end: tag.end, markup: tag.markup });
    }

    if (!tag.closing && tag.name === "div") {
      const imageContainer = hasImageContainerClass(tag);
      divStack.push({
        start: position,
        container: imageContainer && activeImageContainerDepth === 0,
        imageContainer,
      });
      if (imageContainer) activeImageContainerDepth += 1;
    } else if (tag.closing && tag.name === "div") {
      const opening = divStack.pop();
      if (opening?.container) containers.push({ start: opening.start, end: tag.end, markup: markup.substring(opening.start, tag.end) });
      if (opening?.imageContainer) activeImageContainerDepth -= 1;
    }

    position = tag.end;
  }

  return { images, containers };
}

export function replaceActualImageTokens(
  markup: string,
  replace: (imageMarkup: string) => string,
): string {
  const images = findActualImageTokens(markup);
  if (images.length === 0) return markup;

  let result = "";
  let position = 0;
  for (const image of images) {
    result += markup.substring(position, image.start);
    result += replace(image.markup);
    position = image.end;
  }

  return result + markup.substring(position);
}

function findRawTextEnd(markup: string, start: number, tagName: string): number {
  let position = start;
  while (position < markup.length) {
    const nextTag = markup.indexOf("<", position);
    if (nextTag === -1) return markup.length;

    const tag = readHtmlTag(markup, nextTag);
    if (tag === "unterminated") return markup.length;
    if (tag?.closing && tag.name === tagName) return tag.end;

    position = tag ? tag.end : nextTag + 1;
  }

  return markup.length;
}

function readHtmlTag(markup: string, start: number): HtmlTagReadResult {
  let position = start + 1;
  let closing = false;
  if (markup.charAt(position) === "/") {
    closing = true;
    position += 1;
  }

  const nameStart = position;
  while (isTagNameCharacter(markup.charAt(position))) {
    position += 1;
  }

  if (position === nameStart) return null;

  const name = markup.substring(nameStart, position).toLowerCase();
  const attributeStart = position;
  let quote = "";
  while (position < markup.length) {
    const character = markup.charAt(position);
    if (quote) {
      if (character === quote) quote = "";
      position += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      position += 1;
      continue;
    }

    if (character === ">") {
      const end = position + 1;
      const tagMarkup = markup.substring(start, end);
      return { name, closing, end, markup: tagMarkup, attributes: readHtmlAttributes(markup.substring(attributeStart, position)) };
    }

    position += 1;
  }

  return "unterminated";
}

function isTagNameCharacter(character: string): boolean {
  return /[A-Za-z0-9:-]/.test(character);
}

function hasImageContainerClass(tag: HtmlTagToken): boolean {
  return tag.attributes.some((attribute) => attribute.name === "class" && attribute.value.split(/\s+/).includes("image-container"));
}

function readHtmlAttributes(markup: string): readonly HtmlAttribute[] {
  const attributes: HtmlAttribute[] = [];
  const pattern = /(?:^|\s)([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null = pattern.exec(markup);
  while (match !== null) {
    attributes.push({ name: (match[1] ?? "").toLowerCase(), value: match[2] ?? match[3] ?? match[4] ?? "" });
    match = pattern.exec(markup);
  }
  return attributes;
}
