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
var ATTR_RULES = {
  window: { attrs: {}, flags: [] },
  header: { attrs: {}, flags: [] },
  footer: { attrs: {}, flags: [] },
  panel: { attrs: {}, flags: [] },
  row: { attrs: {}, flags: [] },
  col: { attrs: {}, flags: [] },
  text: { attrs: {}, flags: [] },
  button: { attrs: {}, flags: ["primary", "disabled"] },
  input: { attrs: { placeholder: "string", type: "ident" }, flags: ["disabled"] },
  divider: { attrs: {}, flags: [] }
};
var VALID_PRIMITIVES = new Set(Object.keys(ATTR_RULES));
var CONTAINER_CHILD_PRIMITIVES = /* @__PURE__ */ new Set([
  "panel",
  "row",
  "col",
  "text",
  "button",
  "input",
  "divider"
]);
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
  // -- Window ----------------------------------------------------------------
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
      const child = this.parseWindowChild();
      children.push(child);
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
    if (name === "header") return this.parseHeader();
    if (name === "footer") return this.parseFooter();
    return this.parseContainerChildNamed(name);
  }
  // -- Header / Footer -------------------------------------------------------
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
  // -- Container children (panel/row/col + leaves) ---------------------------
  parseContainerChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const child = this.parseContainerChild();
      children.push(child);
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
      throw new WireloomError(
        `"${name}" is not allowed here (legal inside a container: panel, row, col, text, button, input, divider)`,
        head.line,
        head.column
      );
    }
    return this.parseContainerChildNamed(name);
  }
  parseContainerChildNamed(name) {
    switch (name) {
      case "panel":
        return this.parsePanel();
      case "row":
        return this.parseRow();
      case "col":
        return this.parseCol();
      case "text":
        return this.parseText();
      case "button":
        return this.parseButton();
      case "input":
        return this.parseInput();
      case "divider":
        return this.parseDivider();
      default: {
        const head = this.peek();
        throw new WireloomError(unknownPrimitiveMessage(name), head.line, head.column);
      }
    }
  }
  parsePanel() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("panel");
    const hasChildren = this.parseTerminator("panel", head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: "panel", attributes, children, position };
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
    const node = {
      kind: "col",
      attributes: [],
      children: [],
      position
    };
    if (this.peek().kind === "number") {
      const tok = this.consume();
      node.width = {
        value: tok.numericValue ?? 0,
        unit: tok.unit ?? "px"
      };
    }
    node.attributes = this.parseAttributes("col");
    const hasChildren = this.parseTerminator("col", head);
    node.children = hasChildren ? this.parseContainerChildren() : [];
    return node;
  }
  // -- Leaves ----------------------------------------------------------------
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
  parseDivider() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("divider");
    this.parseLeafTerminator("divider", head);
    return { kind: "divider", attributes, position };
  }
  // -- Attributes and terminators -------------------------------------------
  parseAttributes(primitive) {
    const rules = ATTR_RULES[primitive] ?? { attrs: {}, flags: [] };
    const attrs = [];
    while (this.peek().kind === "ident") {
      const keyTok = this.consume();
      const key = keyTok.identValue ?? keyTok.raw;
      const position = positionOf(keyTok);
      if (this.match("equals")) {
        const valueTok = this.consume();
        const expectedKind = rules.attrs[key];
        if (expectedKind === void 0) {
          throw new WireloomError(
            `unknown attribute "${key}" on "${primitive}"`,
            keyTok.line,
            keyTok.column
          );
        }
        const value = coerceAttributeValue(valueTok, expectedKind, key, primitive);
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
  // -- Token helpers ---------------------------------------------------------
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
function coerceAttributeValue(token, expected, key, primitive) {
  const position = positionOf(token);
  if (expected === "string") {
    if (token.kind !== "string") {
      throw new WireloomError(
        `attribute "${key}" on "${primitive}" expects a string value, got ${describeToken(token)}`,
        token.line,
        token.column
      );
    }
    return { kind: "string", value: token.stringValue ?? "", position };
  }
  if (expected === "number") {
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
  }
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
}
function unknownPrimitiveMessage(name) {
  return `unknown primitive "${name}" (valid: window, header, footer, panel, row, col, text, button, input, divider)`;
}

// src/renderer/themes.ts
var DEFAULT_THEME = Object.freeze({
  name: "default",
  background: "#ffffff",
  textColor: "#2d2d2d",
  placeholderColor: "#9aa0a6",
  windowBorderColor: "#505050",
  panelBorderColor: "#8a8a8a",
  dividerColor: "#c4c4c4",
  chromeLineColor: "#b0b0b0",
  buttonBorderColor: "#505050",
  buttonFill: "#ffffff",
  buttonText: "#2d2d2d",
  primaryButtonFill: "#3a3a3a",
  primaryButtonText: "#ffffff",
  disabledColor: "#b8b8b8",
  windowStrokeWidth: 1.25,
  panelStrokeWidth: 1,
  panelStrokeDasharray: "4 3",
  chromeStrokeWidth: 1,
  dividerStrokeWidth: 1,
  buttonStrokeWidth: 1.25,
  inputStrokeWidth: 1,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 14,
  titleFontSize: 16,
  lineHeight: 20,
  averageCharWidth: 7.2,
  windowPadding: 16,
  titleBarHeight: 36,
  panelPadding: 12,
  headerPaddingY: 10,
  footerPaddingY: 10,
  rowGap: 8,
  colGap: 8,
  dividerHeight: 12,
  buttonHeight: 32,
  buttonPaddingX: 16,
  inputHeight: 32,
  inputPaddingX: 12,
  inputMinWidth: 220
});
var DARK_THEME = Object.freeze({
  ...DEFAULT_THEME,
  name: "dark",
  background: "#1e1e1e",
  textColor: "#e0e0e0",
  placeholderColor: "#6b7075",
  windowBorderColor: "#8a8a8a",
  panelBorderColor: "#6b6b6b",
  dividerColor: "#404040",
  chromeLineColor: "#555555",
  buttonBorderColor: "#b0b0b0",
  buttonFill: "#2a2a2a",
  buttonText: "#e0e0e0",
  primaryButtonFill: "#d4d4d4",
  primaryButtonText: "#1e1e1e",
  disabledColor: "#5a5a5a"
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
    case "row":
      return measureRow(node, theme);
    case "col":
      return measureCol(node, theme);
  }
}
function measureText(node, theme) {
  return {
    width: textWidth(node.content, theme),
    height: theme.lineHeight
  };
}
function measureButton(node, theme) {
  return {
    width: textWidth(node.label, theme) + theme.buttonPaddingX * 2,
    height: theme.buttonHeight
  };
}
function measureInput(node, theme) {
  const placeholder = placeholderOf(node);
  const textW = placeholder ? textWidth(placeholder, theme) : 0;
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
function measureRow(node, theme) {
  return measureStack(node.children, theme, "horizontal");
}
function measureCol(node, theme) {
  const inner = measureStack(node.children, theme, "vertical");
  if (node.width !== void 0 && node.width.unit === "px") {
    return { width: node.width.value, height: inner.height };
  }
  return inner;
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
    const gaps2 = (children.length - 1) * theme.colGap;
    return { width: maxChildWidth, height: totalChildHeight + gaps2 };
  }
  const totalChildWidth = sizes.reduce((acc, s) => acc + s.width, 0);
  const maxChildHeight = Math.max(0, ...sizes.map((s) => s.height));
  const gaps = (children.length - 1) * theme.rowGap;
  return { width: totalChildWidth + gaps, height: maxChildHeight };
}
function measureWindow(node, theme) {
  let bodyWidth = 0;
  let bodyHeight = 0;
  let headerHeight = 0;
  let footerHeight = 0;
  const bodyChildren = [];
  let header;
  let footer;
  for (const child of node.children) {
    if (child.kind === "header") header = child;
    else if (child.kind === "footer") footer = child;
    else bodyChildren.push(child);
  }
  const bodyStack = measureStack(bodyChildren, theme, "vertical");
  bodyWidth = bodyStack.width;
  bodyHeight = bodyStack.height;
  if (header) {
    const hs = measureHeaderOrFooter(header, theme, "header");
    headerHeight = hs.height;
    bodyWidth = Math.max(bodyWidth, hs.width);
  }
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
  return node.children.every((c) => c.kind === "button" || c.kind === "text");
}
function titleWidth(title, theme) {
  if (!title) return 0;
  return title.length * (theme.averageCharWidth * (theme.titleFontSize / theme.fontSize)) + theme.windowPadding * 2;
}
function textWidth(text, theme) {
  return text.length * theme.averageCharWidth;
}
function placeholderOf(node) {
  const pair = node.attributes.find(
    (a) => a.kind === "pair" && a.key === "placeholder"
  );
  if (pair?.kind === "pair" && pair.value.kind === "string") {
    return pair.value.value;
  }
  return void 0;
}
function positionWindow(node, m, x, y, theme) {
  const childrenLaid = [];
  const outerWidth = m.outer.width;
  let cursorY = y;
  if (m.hasTitleBar) {
    cursorY += theme.titleBarHeight;
  }
  const bodyChildren = [];
  let header;
  let footer;
  for (const child of node.children) {
    if (child.kind === "header") header = child;
    else if (child.kind === "footer") footer = child;
    else bodyChildren.push(child);
  }
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
    const laidChild = positionContainerChild(
      child,
      bodyInnerX,
      innerCursorY,
      bodyInnerWidth,
      theme
    );
    childrenLaid.push(laidChild);
    innerCursorY += laidChild.height;
    if (i < bodyChildren.length - 1) {
      innerCursorY += theme.colGap;
    }
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
    const totalWidth = sizes.reduce((acc, s) => acc + s.width, 0) + (node.children.length - 1) * theme.rowGap;
    let cursorX = innerX + innerWidth - totalWidth;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const size = sizes[i];
      const laidChild = positionContainerChild(
        child,
        cursorX,
        innerY,
        size.width,
        theme
      );
      children.push(laidChild);
      cursorX += size.width + theme.rowGap;
    }
  } else {
    let cursorY = innerY;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const size = measureChild(child, theme);
      let childX = innerX;
      if (kind === "header") {
        childX = innerX + (innerWidth - size.width) / 2;
      }
      const laidChild = positionContainerChild(
        child,
        childX,
        cursorY,
        size.width,
        theme
      );
      children.push(laidChild);
      cursorY += laidChild.height;
      if (i < node.children.length - 1) {
        cursorY += theme.colGap;
      }
    }
  }
  return { node, x, y, width, height, children };
}
function positionContainerChild(child, x, y, width, theme) {
  switch (child.kind) {
    case "panel":
      return positionPanel(child, x, y, width, theme);
    case "row":
      return positionRow(child, x, y, width, theme);
    case "col":
      return positionCol(child, x, y, width, theme);
    case "text":
      return positionText(child, x, y, width, theme);
    case "button":
      return positionButton(child, x, y, theme);
    case "input":
      return positionInput(child, x, y, width, theme);
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
    if (i < node.children.length - 1) {
      cursorY += theme.colGap;
    }
  }
  const height = cursorY - y + theme.panelPadding;
  return { node, x, y, width, height, children };
}
function positionRow(node, x, y, width, theme) {
  const children = [];
  let cursorX = x;
  let maxHeight = 0;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const size = measureChild(child, theme);
    const laidChild = positionContainerChild(child, cursorX, y, size.width, theme);
    children.push(laidChild);
    cursorX += laidChild.width;
    if (laidChild.height > maxHeight) maxHeight = laidChild.height;
    if (i < node.children.length - 1) {
      cursorX += theme.rowGap;
    }
  }
  return { node, x, y, width: cursorX - x, height: maxHeight, children };
}
function positionCol(node, x, y, width, theme) {
  const colWidth = node.width !== void 0 && node.width.unit === "px" ? node.width.value : measureCol(node, theme).width;
  const children = [];
  let cursorY = y;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const laidChild = positionContainerChild(child, x, cursorY, colWidth, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) {
      cursorY += theme.colGap;
    }
  }
  return { node, x, y, width: colWidth, height: cursorY - y, children };
}
function positionText(node, x, y, width, theme) {
  return {
    node,
    x,
    y,
    width: textWidth(node.content, theme),
    height: theme.lineHeight,
    children: []
  };
}
function positionButton(node, x, y, theme) {
  return {
    node,
    x,
    y,
    width: textWidth(node.label, theme) + theme.buttonPaddingX * 2,
    height: theme.buttonHeight,
    children: []
  };
}
function positionInput(node, x, y, width, theme) {
  const placeholder = placeholderOf(node);
  const textW = placeholder ? textWidth(placeholder, theme) : 0;
  const finalWidth = Math.max(
    theme.inputMinWidth,
    textW + theme.inputPaddingX * 2,
    width
  );
  return {
    node,
    x,
    y,
    width: finalWidth,
    height: theme.inputHeight,
    children: []
  };
}
function positionDivider(node, x, y, width, theme) {
  return { node, x, y, width, height: theme.dividerHeight, children: [] };
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
    case "row":
    case "col":
      for (const c of laid.children) emitNode(c, theme, out);
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
      `<text x="${laid.x + laid.width / 2}" y="${titleY}" text-anchor="middle" font-size="${theme.titleFontSize}" fill="${theme.textColor}">${escapeText(node.title)}</text>`
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
function emitText(laid, theme, out) {
  const node = laid.node;
  const baseline = laid.y + theme.lineHeight * 0.75;
  out.push(
    `<text x="${laid.x}" y="${baseline}" fill="${theme.textColor}">${escapeText(node.content)}</text>`
  );
}
function emitButton(laid, theme, out) {
  const node = laid.node;
  const isPrimary = hasFlag(node.attributes, "primary");
  const isDisabled = hasFlag(node.attributes, "disabled");
  const fill = isPrimary ? theme.primaryButtonFill : theme.buttonFill;
  const text = isPrimary ? theme.primaryButtonText : theme.buttonText;
  const stroke = isDisabled ? theme.disabledColor : theme.buttonBorderColor;
  const opacity = isDisabled ? "0.55" : "1";
  out.push(
    `<g opacity="${opacity}">`,
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${fill}" stroke="${stroke}" stroke-width="${theme.buttonStrokeWidth}" rx="3" />`,
    `<text x="${laid.x + laid.width / 2}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" text-anchor="middle" fill="${isDisabled ? theme.disabledColor : text}">${escapeText(node.label)}</text>`,
    `</g>`
  );
}
function emitInput(laid, theme, out) {
  const node = laid.node;
  const placeholder = getAttributeString(node, "placeholder") ?? "";
  const isDisabled = hasFlag(node.attributes, "disabled");
  const opacity = isDisabled ? "0.55" : "1";
  out.push(
    `<g opacity="${opacity}">`,
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${theme.background}" stroke="${theme.panelBorderColor}" stroke-width="${theme.inputStrokeWidth}" rx="2" />`,
    `<text x="${laid.x + theme.inputPaddingX}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" fill="${theme.placeholderColor}">${escapeText(placeholder)}</text>`,
    `</g>`
  );
}
function emitDivider(laid, theme, out) {
  const y = laid.y + laid.height / 2;
  out.push(
    `<line x1="${laid.x}" y1="${y}" x2="${laid.x + laid.width}" y2="${y}" stroke="${theme.dividerColor}" stroke-width="${theme.dividerStrokeWidth}" />`
  );
}
function hasFlag(attrs, name) {
  return attrs.some((a) => a.kind === "flag" && a.flag === name);
}
function getAttributeString(node, key) {
  for (const a of node.attributes) {
    const attr = a;
    if (attr.kind === "pair" && attr.key === key) {
      const val = attr.value;
      if (val.kind === "string" && typeof val.value === "string") {
        return val.value;
      }
    }
  }
  return void 0;
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
async function render(id, source) {
  const svg = renderWireframe(source, { id });
  return { svg };
}
var wireloom = { initialize, parse: parse2, render };
var index_default = wireloom;

export { DARK_THEME, DEFAULT_THEME, WireloomError, index_default as default, initialize, parse2 as parse, render };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map