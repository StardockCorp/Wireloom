'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// src/config.ts
var DEFAULT_CONFIG = Object.freeze({
  theme: "default",
  securityLevel: "strict"
});
var currentConfig = { ...DEFAULT_CONFIG };
function mergeConfig(partial) {
  currentConfig = { ...currentConfig, ...partial };
}
function getConfig() {
  return { ...currentConfig };
}

// src/parser/errors.ts
var WireloomError = class extends Error {
  line;
  column;
  constructor(message, line, column) {
    super(`Line ${line}, col ${column}: ${message}`);
    this.name = "WireloomError";
    this.line = line;
    this.column = column;
  }
};

// src/parser/lexer.ts
var INDENT_SIZE = 2;
function tokenize(source) {
  const tokens = [];
  const src = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = src.split("\n");
  const indentStack = [0];
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx] ?? "";
    const lineNo = lineIdx + 1;
    const leadingWhitespace = /^[ \t]*/.exec(rawLine)?.[0] ?? "";
    if (leadingWhitespace.includes("	")) {
      const tabColumn = leadingWhitespace.indexOf("	") + 1;
      throw new WireloomError(
        "tab in indentation (use 2 spaces, not tabs)",
        lineNo,
        tabColumn
      );
    }
    const trimmed = rawLine.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const indentSpaces = leadingWhitespace.length;
    if (indentSpaces % INDENT_SIZE !== 0) {
      throw new WireloomError(
        `indentation of ${indentSpaces} spaces is not a multiple of ${INDENT_SIZE}`,
        lineNo,
        1
      );
    }
    const currentLevel = indentStack[indentStack.length - 1] ?? 0;
    if (indentSpaces > currentLevel) {
      if (indentSpaces - currentLevel !== INDENT_SIZE) {
        throw new WireloomError(
          `indentation jumped ${indentSpaces - currentLevel} spaces (only one level at a time is allowed)`,
          lineNo,
          1
        );
      }
      indentStack.push(indentSpaces);
      tokens.push({
        kind: "indent",
        raw: " ".repeat(INDENT_SIZE),
        line: lineNo,
        column: 1
      });
    } else if (indentSpaces < currentLevel) {
      while ((indentStack[indentStack.length - 1] ?? 0) > indentSpaces) {
        indentStack.pop();
        tokens.push({
          kind: "dedent",
          raw: "",
          line: lineNo,
          column: 1
        });
      }
      const backTo = indentStack[indentStack.length - 1] ?? 0;
      if (backTo !== indentSpaces) {
        throw new WireloomError(
          `indentation does not match any outer level (found ${indentSpaces}, open levels: ${indentStack.join(", ")})`,
          lineNo,
          1
        );
      }
    }
    tokenizeLineContent(rawLine, indentSpaces, lineNo, tokens);
    tokens.push({
      kind: "newline",
      raw: "\n",
      line: lineNo,
      column: rawLine.length + 1
    });
  }
  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({
      kind: "dedent",
      raw: "",
      line: lines.length + 1,
      column: 1
    });
  }
  tokens.push({
    kind: "eof",
    raw: "",
    line: lines.length + 1,
    column: 1
  });
  return tokens;
}
function tokenizeLineContent(rawLine, startColumn0, lineNo, tokens) {
  let col = startColumn0;
  const end = rawLine.length;
  while (col < end) {
    const ch = rawLine[col];
    if (ch === " ") {
      col++;
      continue;
    }
    if (ch === "#") {
      return;
    }
    if (ch === '"') {
      const start = col;
      let value = "";
      col++;
      while (col < end) {
        const c = rawLine[col];
        if (c === '"') {
          col++;
          tokens.push({
            kind: "string",
            raw: rawLine.slice(start, col),
            stringValue: value,
            line: lineNo,
            column: start + 1
          });
          break;
        }
        if (c === "\\") {
          const next = rawLine[col + 1];
          if (next === '"') {
            value += '"';
            col += 2;
            continue;
          }
          if (next === "\\") {
            value += "\\";
            col += 2;
            continue;
          }
          if (next === "n") {
            value += "\n";
            col += 2;
            continue;
          }
          throw new WireloomError(
            `invalid escape sequence "\\${next ?? ""}" (supported: \\", \\\\, \\n)`,
            lineNo,
            col + 1
          );
        }
        value += c;
        col++;
      }
      if (col > end || rawLine[col - 1] !== '"') {
        throw new WireloomError(
          "unterminated string literal",
          lineNo,
          start + 1
        );
      }
      continue;
    }
    if (ch !== void 0 && /[0-9]/.test(ch)) {
      const start = col;
      while (col < end && /[0-9]/.test(rawLine[col] ?? "")) {
        col++;
      }
      const digits = rawLine.slice(start, col);
      if (rawLine[col] === "-" && /[0-9]/.test(rawLine[col + 1] ?? "")) {
        col++;
        const maxStart = col;
        while (col < end && /[0-9]/.test(rawLine[col] ?? "")) {
          col++;
        }
        const maxDigits = rawLine.slice(maxStart, col);
        tokens.push({
          kind: "range",
          raw: rawLine.slice(start, col),
          rangeMin: Number.parseInt(digits, 10),
          rangeMax: Number.parseInt(maxDigits, 10),
          line: lineNo,
          column: start + 1
        });
        continue;
      }
      let unit = "px";
      if (rawLine.slice(col, col + 2) === "px") {
        unit = "px";
        col += 2;
      } else if (rawLine[col] === "%") {
        unit = "percent";
        col += 1;
      } else if (rawLine.slice(col, col + 2) === "fr") {
        unit = "fr";
        col += 2;
      }
      tokens.push({
        kind: "number",
        raw: rawLine.slice(start, col),
        numericValue: Number.parseInt(digits, 10),
        unit,
        line: lineNo,
        column: start + 1
      });
      continue;
    }
    if (ch === "=") {
      tokens.push({
        kind: "equals",
        raw: "=",
        line: lineNo,
        column: col + 1
      });
      col++;
      continue;
    }
    if (ch === ":") {
      tokens.push({
        kind: "colon",
        raw: ":",
        line: lineNo,
        column: col + 1
      });
      col++;
      continue;
    }
    if (ch !== void 0 && /[a-zA-Z_]/.test(ch)) {
      const start = col;
      while (col < end && /[a-zA-Z0-9_-]/.test(rawLine[col] ?? "")) {
        col++;
      }
      const ident = rawLine.slice(start, col);
      tokens.push({
        kind: "ident",
        raw: ident,
        identValue: ident,
        line: lineNo,
        column: start + 1
      });
      continue;
    }
    throw new WireloomError(
      `unexpected character "${ch}"`,
      lineNo,
      col + 1
    );
  }
}

// src/parser/parser.ts
var WEIGHT_VALUES = ["light", "regular", "semibold", "bold"];
var SIZE_VALUES = ["small", "regular", "large"];
var ALIGN_VALUES = ["left", "center", "right"];
var INPUT_TYPE_VALUES = ["text", "password", "email"];
var ATTR_RULES = {
  window: { attrs: {}, flags: [] },
  header: { attrs: {}, flags: [] },
  footer: { attrs: {}, flags: [] },
  panel: { attrs: {}, flags: [] },
  section: {
    attrs: { badge: { kind: "string" } },
    flags: []
  },
  tabs: { attrs: {}, flags: [] },
  tab: {
    attrs: { badge: { kind: "string" } },
    flags: ["active"]
  },
  row: {
    attrs: { align: { kind: "enum", values: ALIGN_VALUES } },
    flags: []
  },
  col: { attrs: {}, flags: [] },
  list: { attrs: {}, flags: [] },
  item: { attrs: {}, flags: [] },
  slot: { attrs: {}, flags: ["active"] },
  text: {
    attrs: {
      weight: { kind: "enum", values: WEIGHT_VALUES },
      size: { kind: "enum", values: SIZE_VALUES }
    },
    flags: ["bold", "italic", "muted"]
  },
  button: {
    attrs: { badge: { kind: "string" } },
    flags: ["primary", "disabled"]
  },
  input: {
    attrs: {
      placeholder: { kind: "string" },
      type: { kind: "enum", values: INPUT_TYPE_VALUES }
    },
    flags: ["disabled"]
  },
  combo: {
    attrs: {
      value: { kind: "string" },
      options: { kind: "string" }
    },
    flags: ["disabled"]
  },
  slider: {
    attrs: {
      range: { kind: "range" },
      value: { kind: "number" },
      label: { kind: "string" }
    },
    flags: ["disabled"]
  },
  kv: {
    attrs: {
      weight: { kind: "enum", values: WEIGHT_VALUES },
      size: { kind: "enum", values: SIZE_VALUES }
    },
    flags: ["bold", "italic", "muted"]
  },
  image: {
    attrs: {
      label: { kind: "string" },
      width: { kind: "number" },
      height: { kind: "number" }
    },
    flags: []
  },
  icon: {
    attrs: { name: { kind: "string" } },
    flags: []
  },
  divider: { attrs: {}, flags: [] }
};
var VALID_PRIMITIVES = new Set(Object.keys(ATTR_RULES));
var CONTAINER_CHILD_PRIMITIVES = /* @__PURE__ */ new Set([
  "panel",
  "section",
  "tabs",
  "row",
  "col",
  "list",
  "slot",
  "text",
  "button",
  "input",
  "combo",
  "slider",
  "kv",
  "image",
  "icon",
  "divider"
]);
var LIST_CHILD_PRIMITIVES = /* @__PURE__ */ new Set(["item", "slot"]);
var PRIMITIVE_LIST_HUMAN = "window, header, footer, panel, section, tabs, tab, row, col, list, item, slot, text, button, input, combo, slider, kv, image, icon, divider";
function parse(source) {
  const tokens = tokenize(source);
  const lines = source.split(/\r\n|\r|\n/).length;
  const parser = new Parser(tokens);
  return parser.parseDocument(lines);
}
var Parser = class {
  tokens;
  pos = 0;
  constructor(tokens) {
    this.tokens = tokens;
  }
  parseDocument(sourceLines) {
    if (this.peek().kind === "eof") {
      return { kind: "document", sourceLines };
    }
    const head = this.peek();
    if (head.kind !== "ident") {
      throw new WireloomError(
        `expected root "window" node, got ${describeToken(head)}`,
        head.line,
        head.column
      );
    }
    if (head.identValue !== "window") {
      throw new WireloomError(
        `root node must be "window", got "${head.identValue ?? head.raw}"`,
        head.line,
        head.column
      );
    }
    const root = this.parseWindow();
    if (this.peek().kind !== "eof") {
      const extra = this.peek();
      throw new WireloomError(
        'only one root "window" node is allowed',
        extra.line,
        extra.column
      );
    }
    return { kind: "document", root, sourceLines };
  }
  // --- Window ---------------------------------------------------------------
  parseWindow() {
    const head = this.consume();
    const position = positionOf(head);
    let title;
    if (this.peek().kind === "string") {
      title = this.consume().stringValue;
    }
    const attributes = this.parseAttributes("window");
    const hasChildren = this.parseTerminator("window", head);
    const children = hasChildren ? this.parseWindowChildren() : [];
    const node = { kind: "window", attributes, children, position };
    if (title !== void 0) {
      node.title = title;
    }
    return node;
  }
  parseWindowChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      children.push(this.parseWindowChild());
    }
    this.expectKind("dedent", "children block did not close cleanly");
    return children;
  }
  parseWindowChild() {
    const head = this.peek();
    if (head.kind !== "ident") {
      throw new WireloomError(
        `expected a primitive, got ${describeToken(head)}`,
        head.line,
        head.column
      );
    }
    const name = head.identValue ?? head.raw;
    if (!VALID_PRIMITIVES.has(name)) {
      throw new WireloomError(unknownPrimitiveMessage(name), head.line, head.column);
    }
    if (name === "window") {
      throw new WireloomError(
        '"window" cannot be nested \u2014 only one root "window" is allowed',
        head.line,
        head.column
      );
    }
    if (name === "tab") {
      throw new WireloomError(
        '"tab" may only appear inside "tabs"',
        head.line,
        head.column
      );
    }
    if (name === "item") {
      throw new WireloomError(
        '"item" may only appear inside "list"',
        head.line,
        head.column
      );
    }
    if (name === "header") return this.parseHeader();
    if (name === "footer") return this.parseFooter();
    return this.parseContainerChildNamed(name);
  }
  // --- Header / Footer ------------------------------------------------------
  parseHeader() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("header");
    const hasChildren = this.parseTerminator("header", head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: "header", attributes, children, position };
  }
  parseFooter() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("footer");
    const hasChildren = this.parseTerminator("footer", head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: "footer", attributes, children, position };
  }
  // --- Container children ---------------------------------------------------
  parseContainerChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      children.push(this.parseContainerChild());
    }
    this.expectKind("dedent", "children block did not close cleanly");
    return children;
  }
  parseContainerChild() {
    const head = this.peek();
    if (head.kind !== "ident") {
      throw new WireloomError(
        `expected a primitive, got ${describeToken(head)}`,
        head.line,
        head.column
      );
    }
    const name = head.identValue ?? head.raw;
    if (!VALID_PRIMITIVES.has(name)) {
      throw new WireloomError(unknownPrimitiveMessage(name), head.line, head.column);
    }
    if (!CONTAINER_CHILD_PRIMITIVES.has(name)) {
      const reason = name === "tab" ? '"tab" may only appear inside "tabs"' : name === "item" ? '"item" may only appear inside "list"' : name === "header" || name === "footer" ? `"${name}" may only appear directly inside "window"` : name === "window" ? '"window" cannot be nested' : `"${name}" is not allowed here`;
      throw new WireloomError(reason, head.line, head.column);
    }
    return this.parseContainerChildNamed(name);
  }
  parseContainerChildNamed(name) {
    switch (name) {
      case "panel":
        return this.parsePanel();
      case "section":
        return this.parseSection();
      case "tabs":
        return this.parseTabs();
      case "row":
        return this.parseRow();
      case "col":
        return this.parseCol();
      case "list":
        return this.parseList();
      case "slot":
        return this.parseSlot();
      case "text":
        return this.parseText();
      case "button":
        return this.parseButton();
      case "input":
        return this.parseInput();
      case "combo":
        return this.parseCombo();
      case "slider":
        return this.parseSlider();
      case "kv":
        return this.parseKv();
      case "image":
        return this.parseImage();
      case "icon":
        return this.parseIcon();
      case "divider":
        return this.parseDivider();
      default: {
        const head = this.peek();
        throw new WireloomError(unknownPrimitiveMessage(name), head.line, head.column);
      }
    }
  }
  // --- Panel / Section / Row / Col ------------------------------------------
  parsePanel() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("panel");
    const hasChildren = this.parseTerminator("panel", head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: "panel", attributes, children, position };
  }
  parseSection() {
    const head = this.consume();
    const position = positionOf(head);
    const title = this.expectKind(
      "string",
      '"section" requires a title string (e.g., section "Economy":)'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("section");
    const hasChildren = this.parseTerminator("section", head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: "section", title, attributes, children, position };
  }
  parseTabs() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("tabs");
    const hasChildren = this.parseTerminator("tabs", head);
    const children = hasChildren ? this.parseTabChildren() : [];
    return { kind: "tabs", attributes, children, position };
  }
  parseTabChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      if (head.kind !== "ident") {
        throw new WireloomError(
          `expected a "tab" primitive, got ${describeToken(head)}`,
          head.line,
          head.column
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== "tab") {
        throw new WireloomError(
          `"tabs" accepts only "tab" children (got "${name}")`,
          head.line,
          head.column
        );
      }
      children.push(this.parseTab());
    }
    this.expectKind("dedent", "tabs block did not close cleanly");
    return children;
  }
  parseTab() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"tab" requires a string label (e.g., tab "Government")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("tab");
    this.parseLeafTerminator("tab", head);
    return { kind: "tab", label, attributes, position };
  }
  parseRow() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("row");
    const hasChildren = this.parseTerminator("row", head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: "row", attributes, children, position };
  }
  parseCol() {
    const head = this.consume();
    const position = positionOf(head);
    let width = { kind: "fill" };
    const next = this.peek();
    if (next.kind === "number") {
      const tok = this.consume();
      width = {
        kind: "length",
        value: tok.numericValue ?? 0,
        unit: tok.unit ?? "px"
      };
    } else if (next.kind === "ident" && next.identValue === "fill") {
      this.consume();
      width = { kind: "fill" };
    }
    const attributes = this.parseAttributes("col");
    const hasChildren = this.parseTerminator("col", head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: "col", width, attributes, children, position };
  }
  // --- List / Item / Slot ---------------------------------------------------
  parseList() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("list");
    const hasChildren = this.parseTerminator("list", head);
    const children = hasChildren ? this.parseListChildren() : [];
    return { kind: "list", attributes, children, position };
  }
  parseListChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      if (head.kind !== "ident") {
        throw new WireloomError(
          `expected "item" or "slot", got ${describeToken(head)}`,
          head.line,
          head.column
        );
      }
      const name = head.identValue ?? head.raw;
      if (!LIST_CHILD_PRIMITIVES.has(name)) {
        throw new WireloomError(
          `"list" accepts only "item" or "slot" children (got "${name}")`,
          head.line,
          head.column
        );
      }
      if (name === "item") {
        children.push(this.parseItem());
      } else {
        children.push(this.parseSlot());
      }
    }
    this.expectKind("dedent", "list block did not close cleanly");
    return children;
  }
  parseItem() {
    const head = this.consume();
    const position = positionOf(head);
    const text = this.expectKind(
      "string",
      '"item" requires a string text argument (e.g., item "Home")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("item");
    this.parseLeafTerminator("item", head);
    return { kind: "item", text, attributes, position };
  }
  parseSlot() {
    const head = this.consume();
    const position = positionOf(head);
    const title = this.expectKind(
      "string",
      '"slot" requires a title string (e.g., slot "Colonial Defense Pact":)'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("slot");
    const hasChildren = this.parseTerminator("slot", head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: "slot", title, attributes, children, position };
  }
  // --- Leaves ---------------------------------------------------------------
  parseText() {
    const head = this.consume();
    const position = positionOf(head);
    const content = this.expectKind(
      "string",
      '"text" requires a string argument (e.g., text "Hello")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("text");
    this.parseLeafTerminator("text", head);
    return { kind: "text", content, attributes, position };
  }
  parseButton() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"button" requires a string label (e.g., button "Save")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("button");
    this.parseLeafTerminator("button", head);
    return { kind: "button", label, attributes, position };
  }
  parseInput() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("input");
    this.parseLeafTerminator("input", head);
    return { kind: "input", attributes, position };
  }
  parseCombo() {
    const head = this.consume();
    const position = positionOf(head);
    let label;
    if (this.peek().kind === "string") {
      label = this.consume().stringValue;
    }
    const attributes = this.parseAttributes("combo");
    this.parseLeafTerminator("combo", head);
    const node = { kind: "combo", attributes, position };
    if (label !== void 0) node.label = label;
    return node;
  }
  parseSlider() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("slider");
    this.parseLeafTerminator("slider", head);
    return { kind: "slider", attributes, position };
  }
  parseKv() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"kv" requires a label string (e.g., kv "Tax Rate" "30%")'
    ).stringValue ?? "";
    const value = this.expectKind(
      "string",
      '"kv" requires a value string after the label (e.g., kv "Tax Rate" "30%")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("kv");
    this.parseLeafTerminator("kv", head);
    return { kind: "kv", label, value, attributes, position };
  }
  parseImage() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("image");
    this.parseLeafTerminator("image", head);
    return { kind: "image", attributes, position };
  }
  parseIcon() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("icon");
    this.parseLeafTerminator("icon", head);
    return { kind: "icon", attributes, position };
  }
  parseDivider() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("divider");
    this.parseLeafTerminator("divider", head);
    return { kind: "divider", attributes, position };
  }
  // --- Attributes / terminators --------------------------------------------
  parseAttributes(primitive) {
    const rules = ATTR_RULES[primitive] ?? { attrs: {}, flags: [] };
    const attrs = [];
    while (this.peek().kind === "ident") {
      const keyTok = this.consume();
      const key = keyTok.identValue ?? keyTok.raw;
      const position = positionOf(keyTok);
      if (this.match("equals")) {
        const valueTok = this.consume();
        const spec = rules.attrs[key];
        if (spec === void 0) {
          throw new WireloomError(
            `unknown attribute "${key}" on "${primitive}"`,
            keyTok.line,
            keyTok.column
          );
        }
        const value = coerceAttributeValue(valueTok, spec, key, primitive);
        const pair = { kind: "pair", key, value, position };
        attrs.push(pair);
      } else {
        if (!rules.flags.includes(key)) {
          throw new WireloomError(
            `unknown flag "${key}" on "${primitive}"`,
            keyTok.line,
            keyTok.column
          );
        }
        attrs.push({ kind: "flag", flag: key, position });
      }
    }
    return attrs;
  }
  /** Returns true if a children block follows, false for a leaf. */
  parseTerminator(primitive, headToken) {
    if (this.match("colon")) {
      this.expectKind("newline", `expected newline after "${primitive}:"`);
      if (this.peek().kind !== "indent") {
        throw new WireloomError(
          `"${primitive}" ends with ":" but has no indented children`,
          headToken.line,
          headToken.column
        );
      }
      this.consume();
      return true;
    }
    this.expectKind("newline", `expected newline after "${primitive}"`);
    return false;
  }
  parseLeafTerminator(primitive, headToken) {
    if (this.peek().kind === "colon") {
      throw new WireloomError(
        `"${primitive}" cannot have children`,
        headToken.line,
        headToken.column
      );
    }
    this.expectKind("newline", `expected newline after "${primitive}"`);
  }
  // --- Token helpers --------------------------------------------------------
  peek(offset = 0) {
    const idx = this.pos + offset;
    const tok = this.tokens[idx];
    if (tok !== void 0) return tok;
    const last = this.tokens[this.tokens.length - 1];
    if (last === void 0) {
      throw new WireloomError("empty token stream", 1, 1);
    }
    return last;
  }
  consume() {
    const tok = this.peek();
    this.pos++;
    return tok;
  }
  match(kind) {
    if (this.peek().kind === kind) {
      return this.consume();
    }
    return null;
  }
  expectKind(kind, message) {
    const t = this.peek();
    if (t.kind !== kind) {
      throw new WireloomError(message, t.line, t.column);
    }
    return this.consume();
  }
};
function positionOf(token) {
  return { line: token.line, column: token.column };
}
function describeToken(token) {
  switch (token.kind) {
    case "ident":
      return `identifier "${token.identValue ?? token.raw}"`;
    case "string":
      return `string ${JSON.stringify(token.stringValue ?? "")}`;
    case "number":
      return `number ${token.numericValue}`;
    case "range":
      return `range ${token.rangeMin}-${token.rangeMax}`;
    case "newline":
      return "end of line";
    case "eof":
      return "end of file";
    case "indent":
      return "indentation";
    case "dedent":
      return "dedent";
    case "colon":
      return '":"';
    case "equals":
      return '"="';
  }
}
function coerceAttributeValue(token, spec, key, primitive) {
  const position = positionOf(token);
  switch (spec.kind) {
    case "string":
      if (token.kind !== "string") {
        throw new WireloomError(
          `attribute "${key}" on "${primitive}" expects a string value, got ${describeToken(token)}`,
          token.line,
          token.column
        );
      }
      return { kind: "string", value: token.stringValue ?? "", position };
    case "number":
      if (token.kind !== "number") {
        throw new WireloomError(
          `attribute "${key}" on "${primitive}" expects a number value, got ${describeToken(token)}`,
          token.line,
          token.column
        );
      }
      return {
        kind: "number",
        value: token.numericValue ?? 0,
        unit: token.unit ?? "px",
        position
      };
    case "range":
      if (token.kind !== "range") {
        throw new WireloomError(
          `attribute "${key}" on "${primitive}" expects a range value like "0-100", got ${describeToken(token)}`,
          token.line,
          token.column
        );
      }
      if ((token.rangeMax ?? 0) <= (token.rangeMin ?? 0)) {
        throw new WireloomError(
          `range must be N-M with M > N, got "${token.rangeMin}-${token.rangeMax}"`,
          token.line,
          token.column
        );
      }
      return {
        kind: "range",
        min: token.rangeMin ?? 0,
        max: token.rangeMax ?? 0,
        position
      };
    case "ident":
      if (token.kind !== "ident") {
        throw new WireloomError(
          `attribute "${key}" on "${primitive}" expects an identifier value, got ${describeToken(token)}`,
          token.line,
          token.column
        );
      }
      return {
        kind: "identifier",
        value: token.identValue ?? token.raw,
        position
      };
    case "enum": {
      if (token.kind !== "ident") {
        throw new WireloomError(
          `attribute "${key}" on "${primitive}" expects an identifier value, got ${describeToken(token)}`,
          token.line,
          token.column
        );
      }
      const value = token.identValue ?? token.raw;
      if (!spec.values.includes(value)) {
        throw new WireloomError(
          `"${value}" is not a valid ${key} on "${primitive}" (expected one of: ${spec.values.join(", ")})`,
          token.line,
          token.column
        );
      }
      return { kind: "identifier", value, position };
    }
  }
}
function unknownPrimitiveMessage(name) {
  return `unknown primitive "${name}" (valid: ${PRIMITIVE_LIST_HUMAN})`;
}

// src/parser/serializer.ts
function serialize(doc) {
  if (!doc.root) return "";
  const lines = [];
  serializeNode(doc.root, 0, lines);
  return lines.join("\n") + "\n";
}
function serializeNode(node, depth, out) {
  const indent = "  ".repeat(depth);
  const parts = [node.kind];
  switch (node.kind) {
    case "window":
      if (node.title !== void 0) {
        parts.push(quoteString(node.title));
      }
      break;
    case "section":
      parts.push(quoteString(node.title));
      break;
    case "slot":
      parts.push(quoteString(node.title));
      break;
    case "tab":
      parts.push(quoteString(node.label));
      break;
    case "item":
      parts.push(quoteString(node.text));
      break;
    case "text":
      parts.push(quoteString(node.content));
      break;
    case "button":
      parts.push(quoteString(node.label));
      break;
    case "kv":
      parts.push(quoteString(node.label));
      parts.push(quoteString(node.value));
      break;
    case "combo":
      if (node.label !== void 0) {
        parts.push(quoteString(node.label));
      }
      break;
    case "col": {
      const col = node;
      if (col.width.kind === "length" && col.width.unit === "px") {
        parts.push(String(col.width.value));
      }
      break;
    }
  }
  for (const attr of node.attributes) {
    parts.push(serializeAttribute(attr));
  }
  const children = nodeChildren(node);
  if (children.length > 0) {
    out.push(indent + parts.join(" ") + ":");
    for (const child of children) {
      serializeNode(child, depth + 1, out);
    }
  } else {
    out.push(indent + parts.join(" "));
  }
}
function nodeChildren(node) {
  if ("children" in node && Array.isArray(node.children)) {
    return node.children;
  }
  return [];
}
function serializeAttribute(attr) {
  if (attr.kind === "flag") {
    return attr.flag;
  }
  const pair = attr;
  return `${pair.key}=${serializeValue(pair.value)}`;
}
function serializeValue(v) {
  switch (v.kind) {
    case "string":
      return quoteString(v.value);
    case "number":
      if (v.unit === "percent") return `${v.value}%`;
      if (v.unit === "fr") return `${v.value}fr`;
      return String(v.value);
    case "range":
      return `${v.min}-${v.max}`;
    case "identifier":
      return v.value;
  }
}
function quoteString(s) {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
}

// src/renderer/themes.ts
var DEFAULT_THEME = Object.freeze({
  name: "default",
  background: "#ffffff",
  textColor: "#2d2d2d",
  mutedTextColor: "#7a7f87",
  placeholderColor: "#9aa0a6",
  windowBorderColor: "#505050",
  panelBorderColor: "#8a8a8a",
  sectionTitleColor: "#6b7078",
  dividerColor: "#c4c4c4",
  chromeLineColor: "#b0b0b0",
  buttonBorderColor: "#505050",
  buttonFill: "#ffffff",
  buttonText: "#2d2d2d",
  primaryButtonFill: "#3a3a3a",
  primaryButtonText: "#ffffff",
  disabledColor: "#b8b8b8",
  tabActiveColor: "#2d2d2d",
  tabInactiveColor: "#8a8f97",
  tabUnderlineColor: "#3a3a3a",
  slotBorderColor: "#b5b8bd",
  slotActiveBorderColor: "#3a3a3a",
  slotFillColor: "#fafbfc",
  badgeFill: "#eef0f3",
  badgeText: "#505560",
  sliderTrackColor: "#dde0e4",
  sliderFillColor: "#6b7078",
  sliderThumbColor: "#3a3a3a",
  comboChevronColor: "#6b7078",
  bulletColor: "#8a8f97",
  iconStrokeColor: "#6b7078",
  windowStrokeWidth: 1.25,
  panelStrokeWidth: 1,
  panelStrokeDasharray: "4 3",
  chromeStrokeWidth: 1,
  dividerStrokeWidth: 1,
  buttonStrokeWidth: 1.25,
  inputStrokeWidth: 1,
  slotStrokeWidth: 1,
  slotActiveStrokeWidth: 1.5,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 14,
  titleFontSize: 16,
  sectionTitleFontSize: 11,
  smallFontSize: 12,
  largeFontSize: 18,
  badgeFontSize: 11,
  lineHeight: 20,
  averageCharWidth: 7.2,
  windowPadding: 16,
  titleBarHeight: 36,
  panelPadding: 12,
  headerPaddingY: 10,
  footerPaddingY: 10,
  sectionTitleHeight: 22,
  sectionTitlePaddingBottom: 8,
  slotPadding: 10,
  slotTitleHeight: 22,
  rowGap: 8,
  colGap: 8,
  listGap: 6,
  dividerHeight: 12,
  buttonHeight: 32,
  buttonPaddingX: 16,
  inputHeight: 32,
  inputPaddingX: 12,
  inputMinWidth: 220,
  comboHeight: 32,
  comboChevronWidth: 24,
  comboMinWidth: 180,
  sliderHeight: 28,
  sliderTrackHeight: 4,
  sliderThumbRadius: 7,
  sliderDefaultWidth: 220,
  imageDefaultWidth: 120,
  imageDefaultHeight: 80,
  iconSize: 24,
  tabHeight: 36,
  tabPaddingX: 14,
  tabGap: 2,
  bulletWidth: 16,
  badgeHeight: 18,
  badgePaddingX: 8,
  kvMinWidth: 200,
  colFillMinWidth: 220
});
var DARK_THEME = Object.freeze({
  ...DEFAULT_THEME,
  name: "dark",
  background: "#1e1e1e",
  textColor: "#e0e0e0",
  mutedTextColor: "#8a9099",
  placeholderColor: "#6b7075",
  windowBorderColor: "#8a8a8a",
  panelBorderColor: "#6b6b6b",
  sectionTitleColor: "#8a9099",
  dividerColor: "#404040",
  chromeLineColor: "#555555",
  buttonBorderColor: "#b0b0b0",
  buttonFill: "#2a2a2a",
  buttonText: "#e0e0e0",
  primaryButtonFill: "#d4d4d4",
  primaryButtonText: "#1e1e1e",
  disabledColor: "#5a5a5a",
  tabActiveColor: "#f0f0f0",
  tabInactiveColor: "#707780",
  tabUnderlineColor: "#d4d4d4",
  slotBorderColor: "#555a62",
  slotActiveBorderColor: "#d4d4d4",
  slotFillColor: "#252525",
  badgeFill: "#353a42",
  badgeText: "#b8bcc4",
  sliderTrackColor: "#404040",
  sliderFillColor: "#a0a4ac",
  sliderThumbColor: "#d4d4d4",
  comboChevronColor: "#8a9099",
  bulletColor: "#707780",
  iconStrokeColor: "#8a9099"
});
function getTheme(name) {
  return name === "dark" ? DARK_THEME : DEFAULT_THEME;
}

// src/renderer/layout.ts
function layout(root, theme) {
  const measured = measureWindow(root, theme);
  return positionWindow(root, measured, 0, 0, theme);
}
function measureChild(node, theme) {
  switch (node.kind) {
    case "text":
      return measureText(node, theme);
    case "button":
      return measureButton(node, theme);
    case "input":
      return measureInput(node, theme);
    case "divider":
      return measureDivider(theme);
    case "panel":
      return measurePanel(node, theme);
    case "section":
      return measureSection(node, theme);
    case "tabs":
      return measureTabs(node, theme);
    case "row":
      return measureRow(node, theme);
    case "col":
      return measureCol(node, theme);
    case "list":
      return measureList(node, theme);
    case "slot":
      return measureSlot(node, theme);
    case "kv":
      return measureKv(node, theme);
    case "combo":
      return measureCombo(node, theme);
    case "slider":
      return measureSlider(theme);
    case "image":
      return measureImage(node, theme);
    case "icon":
      return measureIcon(theme);
  }
}
function measureText(node, theme) {
  return {
    width: textWidth(node.content, node.attributes, theme),
    height: textLineHeight(node.attributes, theme)
  };
}
function measureButton(node, theme) {
  const labelW = node.label.length * theme.averageCharWidth;
  const badgeW = badgeWidthOf(node.attributes, theme);
  return {
    width: labelW + theme.buttonPaddingX * 2 + (badgeW > 0 ? badgeW + theme.rowGap : 0),
    height: theme.buttonHeight
  };
}
function measureInput(node, theme) {
  const placeholder = getAttrString(node.attributes, "placeholder");
  const textW = placeholder ? placeholder.length * theme.averageCharWidth : 0;
  return {
    width: Math.max(theme.inputMinWidth, textW + theme.inputPaddingX * 2),
    height: theme.inputHeight
  };
}
function measureDivider(theme) {
  return { width: 0, height: theme.dividerHeight };
}
function measurePanel(node, theme) {
  const inner = measureStack(node.children, theme, "vertical");
  return {
    width: inner.width + theme.panelPadding * 2,
    height: inner.height + theme.panelPadding * 2
  };
}
function measureSection(node, theme) {
  const inner = measureStack(node.children, theme, "vertical");
  const titleRowW = node.title.length * theme.averageCharWidth + badgeWidthOf(node.attributes, theme) + theme.rowGap;
  return {
    width: Math.max(inner.width, titleRowW),
    height: theme.sectionTitleHeight + theme.sectionTitlePaddingBottom + inner.height + theme.panelPadding
  };
}
function measureTabs(node, theme) {
  const sizes = node.children.map((t) => measureTab(t, theme));
  const total = sizes.reduce((acc, s) => acc + s.width, 0) + Math.max(0, node.children.length - 1) * theme.tabGap;
  return { width: total, height: theme.tabHeight };
}
function measureTab(node, theme) {
  const labelW = node.label.length * theme.averageCharWidth;
  const badgeW = badgeWidthOf(node.attributes, theme);
  return {
    width: labelW + theme.tabPaddingX * 2 + (badgeW > 0 ? badgeW + 6 : 0),
    height: theme.tabHeight
  };
}
function measureRow(node, theme) {
  return measureStack(node.children, theme, "horizontal");
}
function measureCol(node, theme) {
  const inner = measureStack(node.children, theme, "vertical");
  if (node.width.kind === "length" && node.width.unit === "px") {
    return { width: node.width.value, height: inner.height };
  }
  return {
    width: Math.max(inner.width, theme.colFillMinWidth),
    height: inner.height
  };
}
function measureList(node, theme) {
  if (node.children.length === 0) return { width: 0, height: 0 };
  let maxW = 0;
  let totalH = 0;
  for (const child of node.children) {
    const size = child.kind === "item" ? measureItem(child, theme) : measureSlot(child, theme);
    if (size.width > maxW) maxW = size.width;
    totalH += size.height;
  }
  totalH += (node.children.length - 1) * theme.listGap;
  return { width: maxW, height: totalH };
}
function measureItem(node, theme) {
  const textW = node.text.length * theme.averageCharWidth;
  return {
    width: theme.bulletWidth + textW,
    height: theme.lineHeight
  };
}
function measureSlot(node, theme) {
  const inner = measureStack(node.children, theme, "vertical");
  const titleW = node.title.length * theme.averageCharWidth;
  return {
    width: Math.max(inner.width, titleW) + theme.slotPadding * 2,
    height: theme.slotTitleHeight + theme.sectionTitlePaddingBottom + inner.height + theme.slotPadding * 2
  };
}
function measureKv(node, theme) {
  const labelW = node.label.length * theme.averageCharWidth;
  const valueW = node.value.length * textSizeScale(node.attributes, theme) * theme.averageCharWidth;
  return {
    width: Math.max(theme.kvMinWidth, labelW + valueW + theme.rowGap * 3),
    height: textLineHeight(node.attributes, theme)
  };
}
function measureCombo(node, theme) {
  const value = getAttrString(node.attributes, "value") ?? node.label ?? "";
  const textW = value.length * theme.averageCharWidth;
  return {
    width: Math.max(theme.comboMinWidth, textW + theme.inputPaddingX * 2 + theme.comboChevronWidth),
    height: theme.comboHeight
  };
}
function measureSlider(theme) {
  return {
    width: theme.sliderDefaultWidth,
    height: theme.sliderHeight
  };
}
function measureImage(node, theme) {
  const width = getAttrNumber(node.attributes, "width") ?? theme.imageDefaultWidth;
  const height = getAttrNumber(node.attributes, "height") ?? theme.imageDefaultHeight;
  return { width, height };
}
function measureIcon(theme) {
  return { width: theme.iconSize, height: theme.iconSize };
}
function measureStack(children, theme, direction) {
  if (children.length === 0) return { width: 0, height: 0 };
  const sizes = children.map((c) => measureChild(c, theme));
  if (direction === "vertical") {
    const maxChildWidth = Math.max(
      0,
      ...sizes.map((s, i) => children[i]?.kind === "divider" ? 0 : s.width)
    );
    const totalChildHeight = sizes.reduce((acc, s) => acc + s.height, 0);
    const gaps2 = Math.max(0, children.length - 1) * theme.colGap;
    return { width: maxChildWidth, height: totalChildHeight + gaps2 };
  }
  const totalChildWidth = sizes.reduce((acc, s) => acc + s.width, 0);
  const maxChildHeight = Math.max(0, ...sizes.map((s) => s.height));
  const gaps = Math.max(0, children.length - 1) * theme.rowGap;
  return { width: totalChildWidth + gaps, height: maxChildHeight };
}
function measureWindow(node, theme) {
  const { header, footer, bodyChildren } = classifyWindowChildren(node);
  const bodyStack = measureStack(bodyChildren, theme, "vertical");
  let bodyWidth = bodyStack.width;
  let bodyHeight = bodyStack.height;
  let headerHeight = 0;
  if (header) {
    const hs = measureHeaderOrFooter(header, theme, "header");
    headerHeight = hs.height;
    bodyWidth = Math.max(bodyWidth, hs.width);
  }
  let footerHeight = 0;
  if (footer) {
    const fs = measureHeaderOrFooter(footer, theme, "footer");
    footerHeight = fs.height;
    bodyWidth = Math.max(bodyWidth, fs.width);
  }
  const hasTitleBar = node.title !== void 0;
  const padding = theme.windowPadding;
  const bodySize = {
    width: bodyWidth + padding * 2,
    height: bodyHeight + padding * 2
  };
  const outerWidth = Math.max(bodySize.width, titleWidth(node.title, theme));
  const outerHeight = (hasTitleBar ? theme.titleBarHeight : 0) + headerHeight + bodySize.height + footerHeight;
  return {
    outer: { width: outerWidth, height: outerHeight },
    body: bodySize,
    headerHeight,
    footerHeight,
    hasTitleBar
  };
}
function measureHeaderOrFooter(node, theme, kind) {
  const direction = footerHorizontal(node, kind) ? "horizontal" : "vertical";
  const inner = measureStack(node.children, theme, direction);
  const padY = kind === "header" ? theme.headerPaddingY : theme.footerPaddingY;
  return {
    width: inner.width + theme.windowPadding * 2,
    height: inner.height + padY * 2
  };
}
function footerHorizontal(node, kind) {
  if (kind !== "footer") return false;
  if (node.children.length === 0) return false;
  return node.children.every(
    (c) => c.kind === "button" || c.kind === "text" || c.kind === "row"
  );
}
function classifyWindowChildren(node) {
  let header;
  let footer;
  const bodyChildren = [];
  for (const child of node.children) {
    if (child.kind === "header") header = child;
    else if (child.kind === "footer") footer = child;
    else bodyChildren.push(child);
  }
  return { header, footer, bodyChildren };
}
function titleWidth(title, theme) {
  if (!title) return 0;
  return title.length * (theme.averageCharWidth * (theme.titleFontSize / theme.fontSize)) + theme.windowPadding * 2;
}
function positionWindow(node, m, x, y, theme) {
  const childrenLaid = [];
  const outerWidth = m.outer.width;
  let cursorY = y;
  if (m.hasTitleBar) {
    cursorY += theme.titleBarHeight;
  }
  const { header, footer, bodyChildren } = classifyWindowChildren(node);
  if (header) {
    const laidHeader = positionHeaderOrFooter(
      header,
      "header",
      x,
      cursorY,
      outerWidth,
      m.headerHeight,
      theme
    );
    childrenLaid.push(laidHeader);
    cursorY += m.headerHeight;
  }
  const bodyY = cursorY;
  const bodyInnerX = x + theme.windowPadding;
  const bodyInnerY = bodyY + theme.windowPadding;
  const bodyInnerWidth = outerWidth - theme.windowPadding * 2;
  let innerCursorY = bodyInnerY;
  for (let i = 0; i < bodyChildren.length; i++) {
    const child = bodyChildren[i];
    const laidChild = positionContainerChild(child, bodyInnerX, innerCursorY, bodyInnerWidth, theme);
    childrenLaid.push(laidChild);
    innerCursorY += laidChild.height;
    if (i < bodyChildren.length - 1) innerCursorY += theme.colGap;
  }
  const bodyEndY = bodyY + m.body.height;
  cursorY = bodyEndY;
  if (footer) {
    const laidFooter = positionHeaderOrFooter(
      footer,
      "footer",
      x,
      cursorY,
      outerWidth,
      m.footerHeight,
      theme
    );
    childrenLaid.push(laidFooter);
    cursorY += m.footerHeight;
  }
  return {
    node,
    x,
    y,
    width: outerWidth,
    height: m.outer.height,
    children: childrenLaid
  };
}
function positionHeaderOrFooter(node, kind, x, y, width, height, theme) {
  const horizontal = footerHorizontal(node, kind);
  const padY = kind === "header" ? theme.headerPaddingY : theme.footerPaddingY;
  const innerX = x + theme.windowPadding;
  const innerY = y + padY;
  const innerWidth = width - theme.windowPadding * 2;
  const children = [];
  if (horizontal) {
    const sizes = node.children.map((c) => measureChild(c, theme));
    const totalWidth = sizes.reduce((acc, s) => acc + s.width, 0) + Math.max(0, node.children.length - 1) * theme.rowGap;
    let cursorX = innerX + innerWidth - totalWidth;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const size = sizes[i];
      children.push(positionContainerChild(child, cursorX, innerY, size.width, theme));
      cursorX += size.width + theme.rowGap;
    }
  } else {
    let cursorY = innerY;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const size = measureChild(child, theme);
      const childX = kind === "header" ? innerX + (innerWidth - size.width) / 2 : innerX;
      const childWidth = kind === "header" ? size.width : innerWidth;
      const laidChild = positionContainerChild(child, childX, cursorY, childWidth, theme);
      children.push(laidChild);
      cursorY += laidChild.height;
      if (i < node.children.length - 1) cursorY += theme.colGap;
    }
  }
  return { node, x, y, width, height, children };
}
function positionContainerChild(child, x, y, width, theme) {
  switch (child.kind) {
    case "panel":
      return positionPanel(child, x, y, width, theme);
    case "section":
      return positionSection(child, x, y, width, theme);
    case "tabs":
      return positionTabs(child, x, y, width, theme);
    case "row":
      return positionRow(child, x, y, width, theme);
    case "col":
      return positionCol(child, x, y, width, theme);
    case "list":
      return positionList(child, x, y, width, theme);
    case "slot":
      return positionSlot(child, x, y, width, theme);
    case "text":
      return positionText(child, x, y, width, theme);
    case "button":
      return positionButton(child, x, y, theme);
    case "input":
      return positionInput(child, x, y, width, theme);
    case "combo":
      return positionCombo(child, x, y, width, theme);
    case "slider":
      return positionSlider(child, x, y, width, theme);
    case "kv":
      return positionKv(child, x, y, width, theme);
    case "image":
      return positionImage(child, x, y, theme);
    case "icon":
      return positionIcon(child, x, y, theme);
    case "divider":
      return positionDivider(child, x, y, width, theme);
  }
}
function positionPanel(node, x, y, width, theme) {
  const innerX = x + theme.panelPadding;
  const innerY = y + theme.panelPadding;
  const innerWidth = width - theme.panelPadding * 2;
  const children = [];
  let cursorY = innerY;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const laidChild = positionContainerChild(child, innerX, cursorY, innerWidth, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) cursorY += theme.colGap;
  }
  const height = cursorY - y + theme.panelPadding;
  return { node, x, y, width, height, children };
}
function positionSection(node, x, y, width, theme) {
  const innerX = x;
  const innerY = y + theme.sectionTitleHeight + theme.sectionTitlePaddingBottom;
  const innerWidth = width;
  const children = [];
  let cursorY = innerY;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const laidChild = positionContainerChild(child, innerX, cursorY, innerWidth, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) cursorY += theme.colGap;
  }
  const height = cursorY - y + theme.panelPadding;
  return { node, x, y, width, height, children };
}
function positionTabs(node, x, y, width, theme) {
  const children = [];
  let cursorX = x;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const size = measureTab(child, theme);
    children.push({
      node: child,
      x: cursorX,
      y,
      width: size.width,
      height: size.height,
      children: []
    });
    cursorX += size.width + theme.tabGap;
  }
  return { node, x, y, width, height: theme.tabHeight, children };
}
function positionRow(node, x, y, width, theme) {
  const baseWidths = [];
  let fillCount = 0;
  for (const child of node.children) {
    if (child.kind === "col" && child.width.kind === "fill") {
      baseWidths.push(0);
      fillCount++;
    } else if (child.kind === "col" && child.width.kind === "length" && child.width.unit === "px") {
      baseWidths.push(child.width.value);
    } else {
      baseWidths.push(measureChild(child, theme).width);
    }
  }
  const gapTotal = Math.max(0, node.children.length - 1) * theme.rowGap;
  const fixedTotal = baseWidths.reduce((acc, w) => acc + w, 0);
  const available = Math.max(0, width - fixedTotal - gapTotal);
  const fillWidth = fillCount > 0 ? available / fillCount : 0;
  const assignedWidths = node.children.map((child, i) => {
    if (child.kind === "col" && child.width.kind === "fill") {
      return Math.max(fillWidth, theme.colFillMinWidth);
    }
    return baseWidths[i] ?? 0;
  });
  const effectiveWidth = assignedWidths.reduce((acc, w) => acc + w, 0) + gapTotal;
  const align = getAlign(node.attributes);
  let cursorX;
  if (fillCount > 0) {
    cursorX = x;
  } else if (align === "right") {
    cursorX = x + width - effectiveWidth;
  } else if (align === "center") {
    cursorX = x + (width - effectiveWidth) / 2;
  } else {
    cursorX = x;
  }
  const children = [];
  let maxHeight = 0;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const childWidth = assignedWidths[i] ?? 0;
    const laidChild = positionContainerChild(child, cursorX, y, childWidth, theme);
    children.push(laidChild);
    cursorX += childWidth;
    if (laidChild.height > maxHeight) maxHeight = laidChild.height;
    if (i < node.children.length - 1) cursorX += theme.rowGap;
  }
  return {
    node,
    x,
    y,
    width: Math.max(width, effectiveWidth),
    height: maxHeight,
    children
  };
}
function positionCol(node, x, y, width, theme) {
  const colWidth = node.width.kind === "length" && node.width.unit === "px" ? node.width.value : width;
  const children = [];
  let cursorY = y;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const laidChild = positionContainerChild(child, x, cursorY, colWidth, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) cursorY += theme.colGap;
  }
  return { node, x, y, width: colWidth, height: cursorY - y, children };
}
function positionList(node, x, y, width, theme) {
  const children = [];
  let cursorY = y;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const laidChild = child.kind === "item" ? positionItem(child, x, cursorY, width, theme) : positionSlot(child, x, cursorY, width, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) cursorY += theme.listGap;
  }
  return { node, x, y, width, height: cursorY - y, children };
}
function positionItem(node, x, y, width, theme) {
  return {
    node,
    x,
    y,
    width,
    height: theme.lineHeight,
    children: []
  };
}
function positionSlot(node, x, y, width, theme) {
  const innerX = x + theme.slotPadding;
  const innerY = y + theme.slotPadding + theme.slotTitleHeight + theme.sectionTitlePaddingBottom;
  const innerWidth = width - theme.slotPadding * 2;
  const children = [];
  let cursorY = innerY;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const laidChild = positionContainerChild(child, innerX, cursorY, innerWidth, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) cursorY += theme.colGap;
  }
  const height = cursorY - y + theme.slotPadding;
  return { node, x, y, width, height, children };
}
function positionText(node, x, y, width, theme) {
  return {
    node,
    x,
    y,
    width: textWidth(node.content, node.attributes, theme),
    height: textLineHeight(node.attributes, theme),
    children: []
  };
}
function positionButton(node, x, y, theme) {
  const size = measureButton(node, theme);
  return {
    node,
    x,
    y,
    width: size.width,
    height: size.height,
    children: []
  };
}
function positionInput(node, x, y, width, theme) {
  const size = measureInput(node, theme);
  return {
    node,
    x,
    y,
    width: Math.max(size.width, Math.min(width, theme.inputMinWidth * 2)),
    height: theme.inputHeight,
    children: []
  };
}
function positionCombo(node, x, y, width, theme) {
  const size = measureCombo(node, theme);
  return {
    node,
    x,
    y,
    width: Math.max(size.width, Math.min(width, 320)),
    height: theme.comboHeight,
    children: []
  };
}
function positionSlider(node, x, y, width, theme) {
  return {
    node,
    x,
    y,
    width: Math.max(theme.sliderDefaultWidth, Math.min(width, 360)),
    height: theme.sliderHeight,
    children: []
  };
}
function positionKv(node, x, y, width, theme) {
  return {
    node,
    x,
    y,
    width,
    height: textLineHeight(node.attributes, theme),
    children: []
  };
}
function positionImage(node, x, y, theme) {
  const size = measureImage(node, theme);
  return { node, x, y, width: size.width, height: size.height, children: [] };
}
function positionIcon(node, x, y, theme) {
  return { node, x, y, width: theme.iconSize, height: theme.iconSize, children: [] };
}
function positionDivider(node, x, y, width, theme) {
  return { node, x, y, width, height: theme.dividerHeight, children: [] };
}
function getAttr(attrs, key) {
  for (const a of attrs) {
    const attr = a;
    if (attr.kind === "pair" && attr.key === key) return attr.value;
  }
  return void 0;
}
function getAttrString(attrs, key) {
  const v = getAttr(attrs, key);
  return v?.kind === "string" ? v.value : void 0;
}
function getAttrNumber(attrs, key) {
  const v = getAttr(attrs, key);
  return v?.kind === "number" ? v.value : void 0;
}
function getAttrIdent(attrs, key) {
  const v = getAttr(attrs, key);
  return v?.kind === "identifier" ? v.value : void 0;
}
function getAlign(attrs) {
  const v = getAttrIdent(attrs, "align");
  if (v === "center" || v === "right" || v === "left") return v;
  return "left";
}
function textSizeScale(attrs, theme) {
  const size = getAttrIdent(attrs, "size");
  if (size === "small") return theme.smallFontSize / theme.fontSize;
  if (size === "large") return theme.largeFontSize / theme.fontSize;
  return 1;
}
function textWidth(content, attrs, theme) {
  return content.length * theme.averageCharWidth * textSizeScale(attrs, theme);
}
function textLineHeight(attrs, theme) {
  const scale = textSizeScale(attrs, theme);
  return theme.lineHeight * scale;
}
function badgeWidthOf(attrs, theme) {
  const badge = getAttrString(attrs, "badge");
  if (badge === void 0) return 0;
  return badge.length * theme.averageCharWidth * (theme.badgeFontSize / theme.fontSize) + theme.badgePaddingX * 2;
}

// src/renderer/svg.ts
function emitSvg(root, theme, options = {}) {
  const parts = [];
  const width = root.width;
  const height = root.height;
  const svgAttrs = [
    'xmlns="http://www.w3.org/2000/svg"',
    `width="${width}"`,
    `height="${height}"`,
    `viewBox="0 0 ${width} ${height}"`,
    `font-family="${escapeAttr(theme.fontFamily)}"`,
    `font-size="${theme.fontSize}"`
  ];
  if (options.id !== void 0) {
    svgAttrs.push(`id="${escapeAttr(options.id)}"`);
  }
  parts.push(`<svg ${svgAttrs.join(" ")}>`);
  parts.push(
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${theme.background}" />`
  );
  emitNode(root, theme, parts);
  parts.push("</svg>");
  return parts.join("");
}
function emitNode(laid, theme, out) {
  const kind = laid.node.kind;
  switch (kind) {
    case "window":
      emitWindow(laid, theme, out);
      break;
    case "header":
    case "footer":
      emitChromeBand(laid, kind, theme, out);
      break;
    case "panel":
      emitPanel(laid, theme, out);
      break;
    case "section":
      emitSection(laid, theme, out);
      break;
    case "tabs":
      emitTabs(laid, theme, out);
      break;
    case "tab":
      emitTab(laid, theme, out);
      break;
    case "row":
    case "col":
      for (const c of laid.children) emitNode(c, theme, out);
      break;
    case "list":
      emitList(laid, theme, out);
      break;
    case "item":
      emitItem(laid, theme, out);
      break;
    case "slot":
      emitSlot(laid, theme, out);
      break;
    case "text":
      emitText(laid, theme, out);
      break;
    case "button":
      emitButton(laid, theme, out);
      break;
    case "input":
      emitInput(laid, theme, out);
      break;
    case "combo":
      emitCombo(laid, theme, out);
      break;
    case "slider":
      emitSlider(laid, theme, out);
      break;
    case "kv":
      emitKv(laid, theme, out);
      break;
    case "image":
      emitImage(laid, theme, out);
      break;
    case "icon":
      emitIcon(laid, theme, out);
      break;
    case "divider":
      emitDivider(laid, theme, out);
      break;
  }
}
function emitWindow(laid, theme, out) {
  const node = laid.node;
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="none" stroke="${theme.windowBorderColor}" stroke-width="${theme.windowStrokeWidth}" />`
  );
  if (node.title !== void 0) {
    const titleBarY = laid.y + theme.titleBarHeight;
    out.push(
      `<line x1="${laid.x}" y1="${titleBarY}" x2="${laid.x + laid.width}" y2="${titleBarY}" stroke="${theme.chromeLineColor}" stroke-width="${theme.chromeStrokeWidth}" />`
    );
    const titleY = laid.y + theme.titleBarHeight / 2 + theme.titleFontSize / 3;
    out.push(
      `<text x="${laid.x + laid.width / 2}" y="${titleY}" text-anchor="middle" font-size="${theme.titleFontSize}" font-weight="600" fill="${theme.textColor}">${escapeText(node.title)}</text>`
    );
  }
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitChromeBand(laid, kind, theme, out) {
  if (kind === "header") {
    out.push(
      `<line x1="${laid.x}" y1="${laid.y + laid.height}" x2="${laid.x + laid.width}" y2="${laid.y + laid.height}" stroke="${theme.chromeLineColor}" stroke-width="${theme.chromeStrokeWidth}" />`
    );
  } else {
    out.push(
      `<line x1="${laid.x}" y1="${laid.y}" x2="${laid.x + laid.width}" y2="${laid.y}" stroke="${theme.chromeLineColor}" stroke-width="${theme.chromeStrokeWidth}" />`
    );
  }
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitPanel(laid, theme, out) {
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="none" stroke="${theme.panelBorderColor}" stroke-width="${theme.panelStrokeWidth}" stroke-dasharray="${theme.panelStrokeDasharray}" rx="2" />`
  );
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitSection(laid, theme, out) {
  const node = laid.node;
  const titleY = laid.y + theme.sectionTitleHeight - 4;
  out.push(
    `<text x="${laid.x}" y="${titleY}" font-size="${theme.sectionTitleFontSize}" font-weight="700" letter-spacing="0.8" fill="${theme.sectionTitleColor}">${escapeText(node.title.toUpperCase())}</text>`
  );
  const badge = getAttrString2(node.attributes, "badge");
  if (badge !== void 0) {
    const badgeW = badgeRenderWidth(badge, theme);
    renderBadgePill(
      laid.x + laid.width - badgeW,
      laid.y + (theme.sectionTitleHeight - theme.badgeHeight) / 2,
      badge,
      theme,
      out
    );
  }
  const lineY = laid.y + theme.sectionTitleHeight;
  out.push(
    `<line x1="${laid.x}" y1="${lineY}" x2="${laid.x + laid.width}" y2="${lineY}" stroke="${theme.dividerColor}" stroke-width="${theme.dividerStrokeWidth}" opacity="0.6" />`
  );
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitTabs(laid, theme, out) {
  const baselineY = laid.y + laid.height - 0.5;
  out.push(
    `<line x1="${laid.x}" y1="${baselineY}" x2="${laid.x + laid.width}" y2="${baselineY}" stroke="${theme.chromeLineColor}" stroke-width="${theme.chromeStrokeWidth}" />`
  );
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitTab(laid, theme, out) {
  const node = laid.node;
  const isActive = hasFlag(node.attributes, "active");
  const badge = getAttrString2(node.attributes, "badge");
  const fill = isActive ? theme.tabActiveColor : theme.tabInactiveColor;
  const weight = isActive ? "600" : "400";
  const labelX = laid.x + theme.tabPaddingX;
  const labelY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${labelX}" y="${labelY}" font-weight="${weight}" fill="${fill}">${escapeText(node.label)}</text>`
  );
  if (badge !== void 0) {
    const labelWidth = node.label.length * theme.averageCharWidth;
    renderBadgePill(
      labelX + labelWidth + 6,
      laid.y + (laid.height - theme.badgeHeight) / 2,
      badge,
      theme,
      out
    );
  }
  if (isActive) {
    const underlineY = laid.y + laid.height - 2;
    out.push(
      `<line x1="${laid.x + 4}" y1="${underlineY}" x2="${laid.x + laid.width - 4}" y2="${underlineY}" stroke="${theme.tabUnderlineColor}" stroke-width="2" />`
    );
  }
}
function emitList(laid, theme, out) {
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitItem(laid, theme, out) {
  const node = laid.node;
  const bulletX = laid.x + 4;
  const bulletY = laid.y + laid.height / 2 + 1;
  out.push(
    `<circle cx="${bulletX + 2}" cy="${bulletY}" r="2" fill="${theme.bulletColor}" />`
  );
  const textX = laid.x + theme.bulletWidth;
  const textY = laid.y + laid.height * 0.7;
  out.push(
    `<text x="${textX}" y="${textY}" fill="${theme.textColor}">${escapeText(node.text)}</text>`
  );
}
function emitSlot(laid, theme, out) {
  const node = laid.node;
  const isActive = hasFlag(node.attributes, "active");
  const stroke = isActive ? theme.slotActiveBorderColor : theme.slotBorderColor;
  const strokeWidth = isActive ? theme.slotActiveStrokeWidth : theme.slotStrokeWidth;
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${theme.slotFillColor}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="4" />`
  );
  const titleX = laid.x + theme.slotPadding;
  const titleY = laid.y + theme.slotPadding + theme.slotTitleHeight * 0.7;
  out.push(
    `<text x="${titleX}" y="${titleY}" font-weight="600" fill="${theme.textColor}">${escapeText(node.title)}</text>`
  );
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitText(laid, theme, out) {
  const node = laid.node;
  const style = textStyle(node.attributes, theme);
  const baseline = laid.y + laid.height * 0.75;
  out.push(
    `<text x="${laid.x}" y="${baseline}"${style}>${escapeText(node.content)}</text>`
  );
}
function emitButton(laid, theme, out) {
  const node = laid.node;
  const isPrimary = hasFlag(node.attributes, "primary");
  const isDisabled = hasFlag(node.attributes, "disabled");
  const fill = isPrimary ? theme.primaryButtonFill : theme.buttonFill;
  const textFill = isPrimary ? theme.primaryButtonText : theme.buttonText;
  const stroke = isDisabled ? theme.disabledColor : theme.buttonBorderColor;
  const opacity = isDisabled ? "0.55" : "1";
  const badge = getAttrString2(node.attributes, "badge");
  out.push(
    `<g opacity="${opacity}">`,
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${fill}" stroke="${stroke}" stroke-width="${theme.buttonStrokeWidth}" rx="3" />`,
    `<text x="${laid.x + laid.width / 2 - (badge ? badgeRenderWidth(badge, theme) / 2 : 0)}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" text-anchor="middle" font-weight="500" fill="${isDisabled ? theme.disabledColor : textFill}">${escapeText(node.label)}</text>`,
    `</g>`
  );
  if (badge !== void 0) {
    renderBadgePill(
      laid.x + laid.width - badgeRenderWidth(badge, theme) - 8,
      laid.y + (laid.height - theme.badgeHeight) / 2,
      badge,
      theme,
      out
    );
  }
}
function emitInput(laid, theme, out) {
  const node = laid.node;
  const placeholder = getAttrString2(node.attributes, "placeholder") ?? "";
  const isDisabled = hasFlag(node.attributes, "disabled");
  const opacity = isDisabled ? "0.55" : "1";
  out.push(
    `<g opacity="${opacity}">`,
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${theme.background}" stroke="${theme.panelBorderColor}" stroke-width="${theme.inputStrokeWidth}" rx="2" />`,
    `<text x="${laid.x + theme.inputPaddingX}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" fill="${theme.placeholderColor}">${escapeText(placeholder)}</text>`,
    `</g>`
  );
}
function emitCombo(laid, theme, out) {
  const node = laid.node;
  const value = getAttrString2(node.attributes, "value") ?? node.label ?? "";
  const isDisabled = hasFlag(node.attributes, "disabled");
  const opacity = isDisabled ? "0.55" : "1";
  const chevronX = laid.x + laid.width - theme.comboChevronWidth + 4;
  const midY = laid.y + laid.height / 2;
  out.push(
    `<g opacity="${opacity}">`,
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${theme.background}" stroke="${theme.panelBorderColor}" stroke-width="${theme.inputStrokeWidth}" rx="2" />`,
    `<text x="${laid.x + theme.inputPaddingX}" y="${midY + theme.fontSize / 3}" fill="${theme.textColor}">${escapeText(value)}</text>`,
    // Chevron ▾
    `<path d="M ${chevronX} ${midY - 3} L ${chevronX + 10} ${midY - 3} L ${chevronX + 5} ${midY + 3} Z" fill="${theme.comboChevronColor}" />`,
    `</g>`
  );
}
function emitSlider(laid, theme, out) {
  const node = laid.node;
  const range = getAttrRange(node.attributes, "range") ?? { min: 0, max: 100 };
  const value = getAttrNumber2(node.attributes, "value") ?? range.min;
  const label = getAttrString2(node.attributes, "label");
  const trackX = laid.x;
  const trackY = laid.y + laid.height / 2 - theme.sliderTrackHeight / 2;
  const trackW = laid.width;
  const thumbT = clamp01((value - range.min) / (range.max - range.min));
  const thumbX = trackX + trackW * thumbT;
  const thumbY = laid.y + laid.height / 2;
  if (label !== void 0) {
    out.push(
      `<text x="${laid.x}" y="${laid.y + theme.fontSize * 0.9}" font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">${escapeText(label)}</text>`
    );
  }
  out.push(
    `<rect x="${trackX}" y="${trackY}" width="${trackW}" height="${theme.sliderTrackHeight}" fill="${theme.sliderTrackColor}" rx="${theme.sliderTrackHeight / 2}" />`
  );
  out.push(
    `<rect x="${trackX}" y="${trackY}" width="${thumbX - trackX}" height="${theme.sliderTrackHeight}" fill="${theme.sliderFillColor}" rx="${theme.sliderTrackHeight / 2}" />`
  );
  out.push(
    `<circle cx="${thumbX}" cy="${thumbY}" r="${theme.sliderThumbRadius}" fill="${theme.sliderThumbColor}" stroke="${theme.background}" stroke-width="1.5" />`
  );
}
function emitKv(laid, theme, out) {
  const node = laid.node;
  const valueStyle = textStyle(node.attributes, theme);
  const baseline = laid.y + laid.height * 0.75;
  out.push(
    `<text x="${laid.x}" y="${baseline}" fill="${theme.textColor}">${escapeText(node.label)}</text>`
  );
  out.push(
    `<text x="${laid.x + laid.width}" y="${baseline}" text-anchor="end"${valueStyle}>${escapeText(node.value)}</text>`
  );
}
function emitImage(laid, theme, out) {
  const node = laid.node;
  const label = getAttrString2(node.attributes, "label") ?? "image";
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${theme.slotFillColor}" stroke="${theme.panelBorderColor}" stroke-width="${theme.panelStrokeWidth}" stroke-dasharray="${theme.panelStrokeDasharray}" rx="2" />`
  );
  out.push(
    `<line x1="${laid.x}" y1="${laid.y}" x2="${laid.x + laid.width}" y2="${laid.y + laid.height}" stroke="${theme.panelBorderColor}" stroke-width="0.5" opacity="0.4" />`,
    `<line x1="${laid.x + laid.width}" y1="${laid.y}" x2="${laid.x}" y2="${laid.y + laid.height}" stroke="${theme.panelBorderColor}" stroke-width="0.5" opacity="0.4" />`
  );
  out.push(
    `<text x="${laid.x + laid.width / 2}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" text-anchor="middle" font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">${escapeText(label)}</text>`
  );
}
function emitIcon(laid, theme, out) {
  const node = laid.node;
  const name = getAttrString2(node.attributes, "name") ?? "?";
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="none" stroke="${theme.iconStrokeColor}" stroke-width="1" rx="3" />`
  );
  const glyph = name.charAt(0).toUpperCase();
  out.push(
    `<text x="${laid.x + laid.width / 2}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" text-anchor="middle" font-size="${theme.smallFontSize}" fill="${theme.iconStrokeColor}">${escapeText(glyph)}</text>`
  );
}
function emitDivider(laid, theme, out) {
  const y = laid.y + laid.height / 2;
  out.push(
    `<line x1="${laid.x}" y1="${y}" x2="${laid.x + laid.width}" y2="${y}" stroke="${theme.dividerColor}" stroke-width="${theme.dividerStrokeWidth}" />`
  );
}
function textStyle(attrs, theme) {
  const isBold = hasFlag(attrs, "bold");
  const isItalic = hasFlag(attrs, "italic");
  const isMuted = hasFlag(attrs, "muted");
  const weight = getAttrIdent2(attrs, "weight");
  const size = getAttrIdent2(attrs, "size");
  const parts = [];
  let fontWeight = null;
  if (weight === "light") fontWeight = "300";
  else if (weight === "semibold") fontWeight = "600";
  else if (weight === "bold") fontWeight = "700";
  else if (weight === "regular") fontWeight = "400";
  else if (isBold) fontWeight = "700";
  if (fontWeight) parts.push(`font-weight="${fontWeight}"`);
  let fontSize = null;
  if (size === "small") fontSize = theme.smallFontSize;
  else if (size === "large") fontSize = theme.largeFontSize;
  if (fontSize !== null) parts.push(`font-size="${fontSize}"`);
  if (isItalic) parts.push(`font-style="italic"`);
  const fill = isMuted ? theme.mutedTextColor : theme.textColor;
  parts.push(`fill="${fill}"`);
  return " " + parts.join(" ");
}
function renderBadgePill(x, y, text, theme, out) {
  const w = badgeRenderWidth(text, theme);
  const h = theme.badgeHeight;
  out.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${theme.badgeFill}" />`,
    `<text x="${x + w / 2}" y="${y + h / 2 + theme.badgeFontSize / 3}" text-anchor="middle" font-size="${theme.badgeFontSize}" font-weight="600" fill="${theme.badgeText}">${escapeText(text)}</text>`
  );
}
function badgeRenderWidth(text, theme) {
  const charW = theme.averageCharWidth * (theme.badgeFontSize / theme.fontSize);
  return text.length * charW + theme.badgePaddingX * 2;
}
function hasFlag(attrs, name) {
  return attrs.some((a) => a.kind === "flag" && a.flag === name);
}
function getAttr2(attrs, key) {
  for (const a of attrs) {
    if (a.kind === "pair" && a.key === key) {
      return a.value;
    }
  }
  return void 0;
}
function getAttrString2(attrs, key) {
  const v = getAttr2(attrs, key);
  return v?.kind === "string" ? v.value : void 0;
}
function getAttrNumber2(attrs, key) {
  const v = getAttr2(attrs, key);
  return v?.kind === "number" ? v.value : void 0;
}
function getAttrIdent2(attrs, key) {
  const v = getAttr2(attrs, key);
  return v?.kind === "identifier" ? v.value : void 0;
}
function getAttrRange(attrs, key) {
  const v = getAttr2(attrs, key);
  return v?.kind === "range" ? { min: v.min, max: v.max } : void 0;
}
function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
function escapeText(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// src/renderer/index.ts
function renderWireframe(source, options = {}) {
  const doc = parse(source);
  if (!doc.root) {
    return emptySvg();
  }
  const themeName = options.theme ?? getConfig().theme;
  const theme = getTheme(themeName);
  const laid = layout(doc.root, theme);
  const emitOpts = options.id !== void 0 ? { id: options.id } : {};
  return emitSvg(laid, theme, emitOpts);
}
function emptySvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>';
}

// src/index.ts
function initialize(config) {
  mergeConfig(config);
}
function parse2(source) {
  return parse(source);
}
function serialize2(doc) {
  return serialize(doc);
}
async function render(id, source, options) {
  const rwOpts = { id };
  if (options?.theme !== void 0) rwOpts.theme = options.theme;
  const svg = renderWireframe(source, rwOpts);
  return { svg };
}
var wireloom = { initialize, parse: parse2, render };
var index_default = wireloom;

exports.DARK_THEME = DARK_THEME;
exports.DEFAULT_THEME = DEFAULT_THEME;
exports.WireloomError = WireloomError;
exports.default = index_default;
exports.initialize = initialize;
exports.parse = parse2;
exports.render = render;
exports.serialize = serialize2;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map