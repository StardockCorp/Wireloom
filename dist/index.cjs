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
var ALLOWED_INDENT_SIZES = [2, 4];
function tokenize(source) {
  const tokens = [];
  const src = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = src.split("\n");
  const indentStack = [0];
  let indentUnit = null;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx] ?? "";
    const lineNo = lineIdx + 1;
    const leadingWhitespace = /^[ \t]*/.exec(rawLine)?.[0] ?? "";
    if (leadingWhitespace.includes("	")) {
      const tabColumn = leadingWhitespace.indexOf("	") + 1;
      throw new WireloomError(
        "tab in indentation (use 2 or 4 spaces, not tabs)",
        lineNo,
        tabColumn
      );
    }
    const trimmed = rawLine.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const indentSpaces = leadingWhitespace.length;
    if (indentUnit === null && indentSpaces > 0) {
      if (!ALLOWED_INDENT_SIZES.includes(indentSpaces)) {
        throw new WireloomError(
          `first indented line uses ${indentSpaces} spaces; Wireloom accepts 2 or 4 spaces per level (pick one and use it consistently)`,
          lineNo,
          1
        );
      }
      indentUnit = indentSpaces;
    }
    const unit = indentUnit ?? 2;
    if (indentSpaces % unit !== 0) {
      throw new WireloomError(
        `indentation of ${indentSpaces} spaces is not a multiple of ${unit} (this file uses ${unit}-space indentation)`,
        lineNo,
        1
      );
    }
    const currentLevel = indentStack[indentStack.length - 1] ?? 0;
    if (indentSpaces > currentLevel) {
      if (indentSpaces - currentLevel !== unit) {
        throw new WireloomError(
          `indentation jumped ${indentSpaces - currentLevel} spaces (only one level of ${unit} at a time is allowed)`,
          lineNo,
          1
        );
      }
      indentStack.push(indentSpaces);
      tokens.push({
        kind: "indent",
        raw: " ".repeat(unit),
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
var JUSTIFY_VALUES = ["start", "between", "around", "end"];
var INPUT_TYPE_VALUES = ["text", "password", "email"];
var ACCENT_VALUES = [
  "research",
  "military",
  "industry",
  "wealth",
  "approval",
  "warning",
  "danger",
  "success"
];
var STATE_VALUES = [
  "locked",
  "available",
  "active",
  "purchased",
  "maxed",
  "growing",
  "ripe",
  "withering",
  "cashed"
];
var CHART_KIND_VALUES = ["bar", "line", "pie"];
var ANNOTATION_SIDE_VALUES = ["left", "right", "top", "bottom"];
var AVATAR_SIZE_VALUES = ["small", "medium", "large"];
var STATUS_KIND_VALUES = ["success", "info", "warning", "error"];
var UNIVERSAL_ID_SPEC = { kind: "string" };
var ATTR_RULES = {
  window: { attrs: {}, flags: [] },
  header: { attrs: {}, flags: [] },
  footer: { attrs: {}, flags: [] },
  navbar: { attrs: {}, flags: [] },
  leading: { attrs: {}, flags: [] },
  trailing: { attrs: {}, flags: [] },
  panel: { attrs: {}, flags: [] },
  section: {
    attrs: {
      badge: { kind: "string" },
      accent: { kind: "enum", values: ACCENT_VALUES }
    },
    flags: []
  },
  tabs: { attrs: {}, flags: [] },
  tab: {
    attrs: { badge: { kind: "string" } },
    flags: ["active"]
  },
  row: {
    attrs: {
      align: { kind: "enum", values: ALIGN_VALUES },
      justify: { kind: "enum", values: JUSTIFY_VALUES }
    },
    flags: []
  },
  spacer: { attrs: {}, flags: [] },
  col: { attrs: {}, flags: [] },
  list: { attrs: {}, flags: [] },
  item: { attrs: {}, flags: [] },
  slot: {
    attrs: {
      state: { kind: "enum", values: STATE_VALUES },
      accent: { kind: "enum", values: ACCENT_VALUES }
    },
    flags: ["active"]
  },
  slotFooter: { attrs: {}, flags: [] },
  grid: {
    attrs: {
      cols: { kind: "number" },
      rows: { kind: "number" }
    },
    flags: []
  },
  cell: {
    attrs: {
      row: { kind: "number" },
      col: { kind: "number" },
      state: { kind: "enum", values: STATE_VALUES },
      accent: { kind: "enum", values: ACCENT_VALUES }
    },
    flags: []
  },
  resourcebar: { attrs: {}, flags: [] },
  resource: {
    attrs: {
      name: { kind: "string" },
      value: { kind: "string" },
      icon: { kind: "string" }
    },
    flags: []
  },
  stats: { attrs: {}, flags: [] },
  stat: {
    attrs: {},
    flags: ["bold", "muted"]
  },
  text: {
    attrs: {
      weight: { kind: "enum", values: WEIGHT_VALUES },
      size: { kind: "enum", values: SIZE_VALUES }
    },
    flags: ["bold", "italic", "muted"]
  },
  button: {
    attrs: {
      badge: { kind: "string" },
      accent: { kind: "enum", values: ACCENT_VALUES }
    },
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
    attrs: {
      name: { kind: "string" },
      accent: { kind: "enum", values: ACCENT_VALUES }
    },
    flags: []
  },
  divider: { attrs: {}, flags: [] },
  progress: {
    attrs: {
      value: { kind: "number" },
      max: { kind: "number" },
      label: { kind: "string" },
      accent: { kind: "enum", values: ACCENT_VALUES }
    },
    flags: []
  },
  chart: {
    attrs: {
      kind: { kind: "enum", values: CHART_KIND_VALUES },
      label: { kind: "string" },
      width: { kind: "number" },
      height: { kind: "number" },
      accent: { kind: "enum", values: ACCENT_VALUES }
    },
    flags: []
  },
  annotation: {
    attrs: {
      target: { kind: "string" },
      position: { kind: "enum", values: ANNOTATION_SIDE_VALUES }
    },
    flags: []
  },
  tree: { attrs: {}, flags: [] },
  treeNode: {
    attrs: { icon: { kind: "string" } },
    flags: ["collapsed", "selected"]
  },
  checkbox: {
    attrs: {},
    flags: ["checked", "disabled", "label-right"]
  },
  radio: {
    attrs: { group: { kind: "string" } },
    flags: ["selected", "disabled", "label-right"]
  },
  toggle: {
    attrs: {},
    flags: ["on", "off", "disabled", "label-right"]
  },
  menubar: { attrs: {}, flags: [] },
  menu: { attrs: {}, flags: [] },
  menuitem: {
    attrs: { shortcut: { kind: "string" } },
    flags: ["disabled"]
  },
  separator: { attrs: {}, flags: [] },
  chip: {
    attrs: {
      icon: { kind: "string" },
      accent: { kind: "enum", values: ACCENT_VALUES }
    },
    flags: ["closable", "selected"]
  },
  avatar: {
    attrs: {
      size: { kind: "enum", values: AVATAR_SIZE_VALUES },
      accent: { kind: "enum", values: ACCENT_VALUES }
    },
    flags: []
  },
  breadcrumb: { attrs: {}, flags: [] },
  crumb: {
    attrs: { icon: { kind: "string" } },
    flags: []
  },
  spinner: { attrs: {}, flags: [] },
  status: {
    attrs: {
      kind: { kind: "enum", values: STATUS_KIND_VALUES }
    },
    flags: []
  }
};
var VALID_PRIMITIVES = /* @__PURE__ */ new Set([
  ...Object.keys(ATTR_RULES).filter((k) => k !== "treeNode" && k !== "slotFooter"),
  "node"
]);
var CONTAINER_CHILD_PRIMITIVES = /* @__PURE__ */ new Set([
  "panel",
  "section",
  "tabs",
  "row",
  "col",
  "list",
  "slot",
  "grid",
  "resourcebar",
  "stats",
  "text",
  "button",
  "input",
  "combo",
  "slider",
  "kv",
  "image",
  "icon",
  "divider",
  "progress",
  "chart",
  "tree",
  "menubar",
  "menu",
  "breadcrumb",
  "checkbox",
  "radio",
  "toggle",
  "chip",
  "avatar",
  "spinner",
  "status"
]);
var LIST_CHILD_PRIMITIVES = /* @__PURE__ */ new Set(["item", "slot"]);
var PRIMITIVE_LIST_HUMAN = "window, header, footer, navbar, leading, trailing, panel, section, tabs, tab, row, col, list, item, slot, grid, cell, resourcebar, resource, stats, stat, text, button, input, combo, slider, kv, image, icon, divider, spacer, progress, chart, tree, node, menubar, menu, menuitem, separator, chip, avatar, breadcrumb, crumb, spinner, status";
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
    const annotations = [];
    while (this.peek().kind === "ident") {
      const tok = this.peek();
      const name = tok.identValue ?? tok.raw;
      if (name === "annotation") {
        annotations.push(this.parseAnnotation());
        continue;
      }
      if (name === "window") {
        throw new WireloomError(
          'only one root "window" node is allowed',
          tok.line,
          tok.column
        );
      }
      throw new WireloomError(
        `unexpected "${name}" after "window" \u2014 only "annotation" may follow`,
        tok.line,
        tok.column
      );
    }
    if (this.peek().kind !== "eof") {
      const extra = this.peek();
      throw new WireloomError(
        'only one root "window" node is allowed',
        extra.line,
        extra.column
      );
    }
    const doc = { kind: "document", root, sourceLines };
    if (annotations.length > 0) doc.annotations = annotations;
    return doc;
  }
  // --- Annotation -----------------------------------------------------------
  parseAnnotation() {
    const head = this.consume();
    const position = positionOf(head);
    const body = this.expectKind(
      "string",
      '"annotation" requires a label string (e.g., annotation "Power Button" target="power-btn" position=right)'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("annotation");
    this.parseLeafTerminator("annotation", head);
    const target = getAttrStringValue(attributes, "target");
    if (target === void 0 || target === "") {
      throw new WireloomError(
        '"annotation" requires target="\u2026" referencing an id in the window (e.g., annotation "Power" target="power-btn" position=right)',
        head.line,
        head.column
      );
    }
    const sideRaw = getAttrIdentValue(attributes, "position");
    if (sideRaw === void 0) {
      throw new WireloomError(
        '"annotation" requires position=left|right|top|bottom (explicit placement \u2014 no default)',
        head.line,
        head.column
      );
    }
    const side = sideRaw;
    return { kind: "annotation", target, side, body, attributes, position };
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
    let navbarSeen;
    let headerSeen;
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      const child = this.parseWindowChild();
      if (child.kind === "navbar") {
        if (headerSeen) {
          throw new WireloomError(
            "navbar and header cannot both appear in a window \u2014 pick one (they share the chrome band)",
            head.line,
            head.column
          );
        }
        navbarSeen = child;
      } else if (child.kind === "header") {
        if (navbarSeen) {
          throw new WireloomError(
            "navbar and header cannot both appear in a window \u2014 pick one (they share the chrome band)",
            head.line,
            head.column
          );
        }
        headerSeen = child;
      }
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
    if (name === "cell") {
      throw new WireloomError(
        '"cell" may only appear inside "grid"',
        head.line,
        head.column
      );
    }
    if (name === "resource") {
      throw new WireloomError(
        '"resource" may only appear inside "resourcebar"',
        head.line,
        head.column
      );
    }
    if (name === "stat") {
      throw new WireloomError(
        '"stat" may only appear inside "stats"',
        head.line,
        head.column
      );
    }
    if (name === "node") {
      throw new WireloomError(
        '"node" may only appear inside "tree"',
        head.line,
        head.column
      );
    }
    if (name === "menuitem") {
      throw new WireloomError(
        '"menuitem" may only appear inside "menu"',
        head.line,
        head.column
      );
    }
    if (name === "separator") {
      throw new WireloomError(
        '"separator" may only appear inside "menu"',
        head.line,
        head.column
      );
    }
    if (name === "crumb") {
      throw new WireloomError(
        '"crumb" may only appear inside "breadcrumb"',
        head.line,
        head.column
      );
    }
    if (name === "spacer") {
      throw new WireloomError(
        '"spacer" may only appear inside "row"',
        head.line,
        head.column
      );
    }
    if (name === "leading" || name === "trailing") {
      throw new WireloomError(
        `"${name}" may only appear inside "navbar"`,
        head.line,
        head.column
      );
    }
    if (name === "header") return this.parseHeader();
    if (name === "footer") return this.parseFooter();
    if (name === "navbar") return this.parseNavbar();
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
  // --- Navbar ---------------------------------------------------------------
  parseNavbar() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("navbar");
    const hasChildren = this.parseTerminator("navbar", head);
    if (!hasChildren) {
      throw new WireloomError(
        '"navbar" requires "leading:" and/or "trailing:" sub-blocks (e.g., navbar:\n  leading:\n    button "Back")',
        head.line,
        head.column
      );
    }
    const { leading, trailing } = this.parseNavbarChildren();
    const node = { kind: "navbar", attributes, position };
    if (leading) node.leading = leading;
    if (trailing) node.trailing = trailing;
    return node;
  }
  /**
   * Parse a navbar's child block. Only `leading:` and `trailing:` are accepted,
   * and each may appear at most once. Source order doesn't matter — the
   * renderer always anchors leading on the left and trailing on the right.
   */
  parseNavbarChildren() {
    let leading;
    let trailing;
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      if (head.kind !== "ident") {
        throw new WireloomError(
          `expected "leading:" or "trailing:" inside "navbar", got ${describeToken(head)}`,
          head.line,
          head.column
        );
      }
      const name = head.identValue ?? head.raw;
      if (name === "leading") {
        if (leading !== void 0) {
          throw new WireloomError(
            '"navbar" may contain at most one "leading:" block',
            head.line,
            head.column
          );
        }
        leading = this.parseNavbarSlot("leading");
      } else if (name === "trailing") {
        if (trailing !== void 0) {
          throw new WireloomError(
            '"navbar" may contain at most one "trailing:" block',
            head.line,
            head.column
          );
        }
        trailing = this.parseNavbarSlot("trailing");
      } else {
        throw new WireloomError(
          `"navbar" accepts only "leading:" or "trailing:" children (got "${name}")`,
          head.line,
          head.column
        );
      }
    }
    this.expectKind("dedent", "navbar block did not close cleanly");
    return { leading, trailing };
  }
  parseNavbarSlot(side) {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes(side);
    const hasChildren = this.parseTerminator(side, head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    const kind = side === "leading" ? "navbarLeading" : "navbarTrailing";
    return { kind, attributes, children, position };
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
      const reason = name === "tab" ? '"tab" may only appear inside "tabs"' : name === "item" ? '"item" may only appear inside "list"' : name === "header" ? '"header" may only appear directly inside "window"' : name === "footer" ? '"footer" may only appear directly inside "window" or "slot"' : name === "navbar" ? '"navbar" may only appear directly inside "window"' : name === "leading" || name === "trailing" ? `"${name}" may only appear inside "navbar"` : name === "window" ? '"window" cannot be nested' : name === "cell" ? '"cell" may only appear inside "grid"' : name === "resource" ? '"resource" may only appear inside "resourcebar"' : name === "stat" ? '"stat" may only appear inside "stats"' : name === "node" ? '"node" may only appear inside "tree"' : name === "menuitem" ? '"menuitem" may only appear inside "menu"' : name === "separator" ? '"separator" may only appear inside "menu"' : name === "crumb" ? '"crumb" may only appear inside "breadcrumb"' : name === "spacer" ? '"spacer" may only appear inside "row"' : `"${name}" is not allowed here`;
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
      case "grid":
        return this.parseGrid();
      case "resourcebar":
        return this.parseResourceBar();
      case "stats":
        return this.parseStats();
      case "progress":
        return this.parseProgress();
      case "chart":
        return this.parseChart();
      case "tree":
        return this.parseTree();
      case "menubar":
        return this.parseMenubar();
      case "menu":
        return this.parseMenu();
      case "breadcrumb":
        return this.parseBreadcrumb();
      case "checkbox":
        return this.parseCheckbox();
      case "radio":
        return this.parseRadio();
      case "toggle":
        return this.parseToggle();
      case "chip":
        return this.parseChip();
      case "avatar":
        return this.parseAvatar();
      case "spinner":
        return this.parseSpinner();
      case "status":
        return this.parseStatus();
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
    const children = hasChildren ? this.parseRowChildren() : [];
    return { kind: "row", attributes, children, position };
  }
  /**
   * Row children accept everything a normal container does, plus `spacer`
   * (flex gap — v0.5). Kept as a separate pass so spacer stays grammar-
   * restricted to rows without widening the general container union.
   */
  parseRowChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      if (head.kind === "ident" && (head.identValue ?? head.raw) === "spacer") {
        children.push(this.parseSpacer());
        continue;
      }
      children.push(this.parseContainerChild());
    }
    this.expectKind("dedent", "children block did not close cleanly");
    return children;
  }
  parseSpacer() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("spacer");
    this.parseLeafTerminator("spacer", head);
    return { kind: "spacer", attributes, position };
  }
  parseCol() {
    const head = this.consume();
    const position = positionOf(head);
    let width = { kind: "fill" };
    const next = this.peek();
    if (next.kind === "number") {
      const tok = this.consume();
      const unit = tok.unit ?? "px";
      if (unit !== "px") {
        throw new WireloomError(
          `"col" positional width must be a pixel number or "fill"; got "${tok.raw}"`,
          tok.line,
          tok.column
        );
      }
      width = { kind: "length", value: tok.numericValue ?? 0, unit: "px" };
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
    const { children, slotFooter } = hasChildren ? this.parseSlotChildren() : { children: [], slotFooter: void 0 };
    const node = { kind: "slot", title, attributes, children, position };
    if (slotFooter) node.slotFooter = slotFooter;
    return node;
  }
  /**
   * Parse children of a `slot`. Accepts standard container children plus an
   * optional trailing `footer:` block (at most one, must be the last child).
   */
  parseSlotChildren() {
    const children = [];
    let slotFooter;
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      const name = head.kind === "ident" ? head.identValue ?? head.raw : void 0;
      if (name === "footer") {
        if (slotFooter !== void 0) {
          throw new WireloomError(
            '"slot" may contain at most one "footer" block',
            head.line,
            head.column
          );
        }
        slotFooter = this.parseSlotFooter();
        continue;
      }
      if (slotFooter !== void 0) {
        throw new WireloomError(
          '"footer" inside "slot" must be the last child',
          head.line,
          head.column
        );
      }
      children.push(this.parseContainerChild());
    }
    this.expectKind("dedent", "slot children block did not close cleanly");
    return slotFooter ? { children, slotFooter } : { children };
  }
  parseSlotFooter() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("slotFooter");
    const hasChildren = this.parseTerminator("footer", head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: "slotFooter", attributes, children, position };
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
    const labelTok = this.expectKind(
      "string",
      '"kv" requires a label string (e.g., kv "Tax Rate" "30%")'
    );
    const label = labelTok.stringValue ?? "";
    if (this.peek().kind !== "string" && /[=:]/.test(label)) {
      const splitChar = label.includes("=") ? "=" : ":";
      const idx = label.indexOf(splitChar);
      const left = label.slice(0, idx).trim();
      const right = label.slice(idx + 1).trim();
      throw new WireloomError(
        `"kv" needs two separate strings (label, value). Got only "${label}" \u2014 if you meant to split on "${splitChar}", try: kv "${left}" "${right}"`,
        labelTok.line,
        labelTok.column
      );
    }
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
  parseProgress() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("progress");
    this.parseLeafTerminator("progress", head);
    return { kind: "progress", attributes, position };
  }
  parseChart() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("chart");
    this.parseLeafTerminator("chart", head);
    return { kind: "chart", attributes, position };
  }
  // --- Grid / Cell ----------------------------------------------------------
  parseGrid() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("grid");
    const cols = getAttrNumberValue(attributes, "cols");
    const rows = getAttrNumberValue(attributes, "rows");
    if (cols === void 0 || cols < 1) {
      throw new WireloomError(
        '"grid" requires cols=N with N>=1 (e.g., grid cols=5 rows=5:)',
        head.line,
        head.column
      );
    }
    if (rows === void 0 || rows < 1) {
      throw new WireloomError(
        '"grid" requires rows=N with N>=1 (e.g., grid cols=5 rows=5:)',
        head.line,
        head.column
      );
    }
    const hasChildren = this.parseTerminator("grid", head);
    const children = hasChildren ? this.parseGridChildren() : [];
    return { kind: "grid", cols, rows, attributes, children, position };
  }
  parseGridChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      if (head.kind !== "ident") {
        throw new WireloomError(
          `expected "cell", got ${describeToken(head)}`,
          head.line,
          head.column
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== "cell") {
        throw new WireloomError(
          `"grid" accepts only "cell" children (got "${name}")`,
          head.line,
          head.column
        );
      }
      children.push(this.parseCell());
    }
    this.expectKind("dedent", "grid block did not close cleanly");
    return children;
  }
  parseCell() {
    const head = this.consume();
    const position = positionOf(head);
    let label;
    if (this.peek().kind === "string") {
      label = this.consume().stringValue;
    }
    const attributes = this.parseAttributes("cell");
    const rowAttr = getAttrNumberValue(attributes, "row");
    const colAttr = getAttrNumberValue(attributes, "col");
    const hasChildren = this.parseTerminator("cell", head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    const node = { kind: "cell", attributes, children, position };
    if (label !== void 0) node.label = label;
    if (rowAttr !== void 0) node.row = rowAttr;
    if (colAttr !== void 0) node.col = colAttr;
    return node;
  }
  // --- ResourceBar / Resource ----------------------------------------------
  parseResourceBar() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("resourcebar");
    const hasChildren = this.parseTerminator("resourcebar", head);
    const children = hasChildren ? this.parseResourceChildren() : [];
    return { kind: "resourcebar", attributes, children, position };
  }
  parseResourceChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      if (head.kind !== "ident") {
        throw new WireloomError(
          `expected "resource", got ${describeToken(head)}`,
          head.line,
          head.column
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== "resource") {
        throw new WireloomError(
          `"resourcebar" accepts only "resource" children (got "${name}")`,
          head.line,
          head.column
        );
      }
      children.push(this.parseResource());
    }
    this.expectKind("dedent", "resourcebar block did not close cleanly");
    return children;
  }
  parseResource() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("resource");
    const name = getAttrStringValue(attributes, "name");
    const value = getAttrStringValue(attributes, "value");
    if (name === void 0) {
      throw new WireloomError(
        '"resource" requires name="\u2026" (e.g., resource name="Credits" value="1,500")',
        head.line,
        head.column
      );
    }
    if (value === void 0) {
      throw new WireloomError(
        '"resource" requires value="\u2026" (e.g., resource name="Credits" value="1,500")',
        head.line,
        head.column
      );
    }
    this.parseLeafTerminator("resource", head);
    return { kind: "resource", name, value, attributes, position };
  }
  // --- Stats / Stat --------------------------------------------------------
  parseStats() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("stats");
    const hasChildren = this.parseTerminator("stats", head);
    const children = hasChildren ? this.parseStatChildren() : [];
    return { kind: "stats", attributes, children, position };
  }
  parseStatChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      if (head.kind !== "ident") {
        throw new WireloomError(
          `expected "stat", got ${describeToken(head)}`,
          head.line,
          head.column
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== "stat") {
        throw new WireloomError(
          `"stats" accepts only "stat" children (got "${name}")`,
          head.line,
          head.column
        );
      }
      children.push(this.parseStat());
    }
    this.expectKind("dedent", "stats block did not close cleanly");
    return children;
  }
  parseStat() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"stat" requires a label string (e.g., stat "INT" "4")'
    ).stringValue ?? "";
    const value = this.expectKind(
      "string",
      '"stat" requires a value string after the label (e.g., stat "INT" "4")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("stat");
    this.parseLeafTerminator("stat", head);
    return { kind: "stat", label, value, attributes, position };
  }
  // --- Tree / node ---------------------------------------------------------
  parseTree() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("tree");
    const hasChildren = this.parseTerminator("tree", head);
    const children = hasChildren ? this.parseTreeChildren() : [];
    return { kind: "tree", attributes, children, position };
  }
  parseTreeChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      if (head.kind !== "ident") {
        throw new WireloomError(
          `expected "node", got ${describeToken(head)}`,
          head.line,
          head.column
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== "node") {
        throw new WireloomError(
          `"tree" accepts only "node" children (got "${name}")`,
          head.line,
          head.column
        );
      }
      children.push(this.parseTreeNode());
    }
    this.expectKind("dedent", "tree block did not close cleanly");
    return children;
  }
  parseTreeNode() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"node" requires a label string (e.g., node "src":)'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("treeNode");
    const hasChildren = this.parseTerminator("node", head);
    const children = hasChildren ? this.parseTreeChildren() : [];
    return { kind: "treeNode", label, attributes, children, position };
  }
  // --- Menubar / Menu ------------------------------------------------------
  parseMenubar() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("menubar");
    const hasChildren = this.parseTerminator("menubar", head);
    const children = hasChildren ? this.parseMenubarChildren() : [];
    return { kind: "menubar", attributes, children, position };
  }
  parseMenubarChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      if (head.kind !== "ident") {
        throw new WireloomError(
          `expected "menu", got ${describeToken(head)}`,
          head.line,
          head.column
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== "menu") {
        throw new WireloomError(
          `"menubar" accepts only "menu" children (got "${name}")`,
          head.line,
          head.column
        );
      }
      children.push(this.parseMenu());
    }
    this.expectKind("dedent", "menubar block did not close cleanly");
    return children;
  }
  parseMenu() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"menu" requires a label string (e.g., menu "File":)'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("menu");
    const hasChildren = this.parseTerminator("menu", head);
    const children = hasChildren ? this.parseMenuChildren() : [];
    return { kind: "menu", label, attributes, children, position };
  }
  parseMenuChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      if (head.kind !== "ident") {
        throw new WireloomError(
          `expected "menuitem", "separator", or "menu", got ${describeToken(head)}`,
          head.line,
          head.column
        );
      }
      const name = head.identValue ?? head.raw;
      if (name === "menuitem") {
        children.push(this.parseMenuItem());
      } else if (name === "separator") {
        children.push(this.parseSeparator());
      } else if (name === "menu") {
        children.push(this.parseMenu());
      } else {
        throw new WireloomError(
          `"menu" accepts only "menuitem", "separator", or nested "menu" (got "${name}")`,
          head.line,
          head.column
        );
      }
    }
    this.expectKind("dedent", "menu block did not close cleanly");
    return children;
  }
  parseMenuItem() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"menuitem" requires a label string (e.g., menuitem "Open\u2026")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("menuitem");
    this.parseLeafTerminator("menuitem", head);
    return { kind: "menuitem", label, attributes, position };
  }
  parseSeparator() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("separator");
    this.parseLeafTerminator("separator", head);
    return { kind: "separator", attributes, position };
  }
  // --- Breadcrumb / crumb --------------------------------------------------
  parseBreadcrumb() {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes("breadcrumb");
    const hasChildren = this.parseTerminator("breadcrumb", head);
    const children = hasChildren ? this.parseBreadcrumbChildren() : [];
    return { kind: "breadcrumb", attributes, children, position };
  }
  parseBreadcrumbChildren() {
    const children = [];
    while (this.peek().kind !== "dedent" && this.peek().kind !== "eof") {
      const head = this.peek();
      if (head.kind !== "ident") {
        throw new WireloomError(
          `expected "crumb", got ${describeToken(head)}`,
          head.line,
          head.column
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== "crumb") {
        throw new WireloomError(
          `"breadcrumb" accepts only "crumb" children (got "${name}")`,
          head.line,
          head.column
        );
      }
      children.push(this.parseCrumb());
    }
    this.expectKind("dedent", "breadcrumb block did not close cleanly");
    return children;
  }
  parseCrumb() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"crumb" requires a label string (e.g., crumb "Documents")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("crumb");
    this.parseLeafTerminator("crumb", head);
    return { kind: "crumb", label, attributes, position };
  }
  // --- Form controls -------------------------------------------------------
  parseCheckbox() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"checkbox" requires a label string (e.g., checkbox "Enable")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("checkbox");
    this.parseLeafTerminator("checkbox", head);
    return { kind: "checkbox", label, attributes, position };
  }
  parseRadio() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"radio" requires a label string (e.g., radio "Light" group="theme")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("radio");
    this.parseLeafTerminator("radio", head);
    return { kind: "radio", label, attributes, position };
  }
  parseToggle() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"toggle" requires a label string (e.g., toggle "Dark mode" on)'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("toggle");
    this.parseLeafTerminator("toggle", head);
    return { kind: "toggle", label, attributes, position };
  }
  // --- Chip / avatar -------------------------------------------------------
  parseChip() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"chip" requires a label string (e.g., chip "Filter")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("chip");
    this.parseLeafTerminator("chip", head);
    return { kind: "chip", label, attributes, position };
  }
  parseAvatar() {
    const head = this.consume();
    const position = positionOf(head);
    const raw = this.expectKind(
      "string",
      '"avatar" requires an initials string (e.g., avatar "BW")'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("avatar");
    this.parseLeafTerminator("avatar", head);
    return { kind: "avatar", initials: raw, attributes, position };
  }
  // --- Spinner / status ----------------------------------------------------
  parseSpinner() {
    const head = this.consume();
    const position = positionOf(head);
    let label;
    if (this.peek().kind === "string") {
      label = this.consume().stringValue;
    }
    const attributes = this.parseAttributes("spinner");
    this.parseLeafTerminator("spinner", head);
    const node = { kind: "spinner", attributes, position };
    if (label !== void 0) node.label = label;
    return node;
  }
  parseStatus() {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      "string",
      '"status" requires a label string (e.g., status "Saved" kind=success)'
    ).stringValue ?? "";
    const attributes = this.parseAttributes("status");
    const kindAttr = getAttrIdentValue(attributes, "kind");
    if (kindAttr === void 0) {
      throw new WireloomError(
        '"status" requires kind=success|info|warning|error',
        head.line,
        head.column
      );
    }
    this.parseLeafTerminator("status", head);
    return { kind: "status", label, attributes, position };
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
        const spec = key === "id" ? UNIVERSAL_ID_SPEC : rules.attrs[key];
        if (spec === void 0) {
          const suggestion = suggestMatch(key, Object.keys(rules.attrs));
          const hint = suggestion ? `. Did you mean "${suggestion}"?` : "";
          throw new WireloomError(
            `unknown attribute "${key}" on "${primitive}"${hint}`,
            keyTok.line,
            keyTok.column
          );
        }
        const value = coerceAttributeValue(valueTok, spec, key, primitive);
        const pair = { kind: "pair", key, value, position };
        attrs.push(pair);
      } else {
        if (!rules.flags.includes(key)) {
          const suggestion = suggestMatch(key, rules.flags);
          const hint = suggestion ? `. Did you mean "${suggestion}"?` : "";
          throw new WireloomError(
            `unknown flag "${key}" on "${primitive}"${hint}`,
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
          `"${primitive}" ends with ":" but has no indented children (for a flex gap in a row, use the "spacer" primitive)`,
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
function getAttrStringValue(attrs, key) {
  for (const a of attrs) {
    if (a.kind === "pair" && a.key === key && a.value.kind === "string") {
      return a.value.value;
    }
  }
  return void 0;
}
function getAttrNumberValue(attrs, key) {
  for (const a of attrs) {
    if (a.kind === "pair" && a.key === key && a.value.kind === "number") {
      return a.value.value;
    }
  }
  return void 0;
}
function getAttrIdentValue(attrs, key) {
  for (const a of attrs) {
    if (a.kind === "pair" && a.key === key && a.value.kind === "identifier") {
      return a.value.value;
    }
  }
  return void 0;
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
        const suggestion = suggestMatch(value, spec.values);
        const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";
        throw new WireloomError(
          `"${value}" is not a valid ${key} on "${primitive}" (expected one of: ${spec.values.join(", ")}).${hint}`,
          token.line,
          token.column
        );
      }
      return { kind: "identifier", value, position };
    }
  }
}
function unknownPrimitiveMessage(name) {
  const suggestion = suggestMatch(name, [...VALID_PRIMITIVES]);
  const base = `unknown primitive "${name}" (valid: ${PRIMITIVE_LIST_HUMAN})`;
  return suggestion ? `${base}. Did you mean "${suggestion}"?` : base;
}
function suggestMatch(input, candidates) {
  if (input.length < 2 || candidates.length === 0) return void 0;
  let best;
  let bestDist = Infinity;
  for (const cand of candidates) {
    const d = levenshtein(input, cand);
    if (d < bestDist) {
      bestDist = d;
      best = cand;
    }
  }
  const threshold = Math.min(2, Math.floor(input.length / 2));
  if (best !== void 0 && bestDist <= threshold) return best;
  return void 0;
}
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost
      );
    }
    prev = [...curr];
  }
  return prev[n] ?? 0;
}

// src/parser/serializer.ts
function serialize(doc) {
  if (!doc.root) return "";
  const lines = [];
  serializeNode(doc.root, 0, lines);
  if (doc.annotations) {
    for (const a of doc.annotations) {
      serializeNode(a, 0, lines);
    }
  }
  return lines.join("\n") + "\n";
}
function serializeNode(node, depth, out) {
  const indent = "  ".repeat(depth);
  const keyword = node.kind === "slotFooter" ? "footer" : node.kind === "treeNode" ? "node" : node.kind === "navbarLeading" ? "leading" : node.kind === "navbarTrailing" ? "trailing" : node.kind;
  const parts = [keyword];
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
    case "cell": {
      const cell = node;
      if (cell.label !== void 0) {
        parts.push(quoteString(cell.label));
      }
      break;
    }
    case "stat":
      parts.push(quoteString(node.label));
      parts.push(quoteString(node.value));
      break;
    case "annotation":
      parts.push(quoteString(node.body));
      break;
    case "treeNode":
      parts.push(quoteString(node.label));
      break;
    case "menu":
      parts.push(quoteString(node.label));
      break;
    case "menuitem":
      parts.push(quoteString(node.label));
      break;
    case "crumb":
      parts.push(quoteString(node.label));
      break;
    case "checkbox":
      parts.push(quoteString(node.label));
      break;
    case "radio":
      parts.push(quoteString(node.label));
      break;
    case "toggle":
      parts.push(quoteString(node.label));
      break;
    case "chip":
      parts.push(quoteString(node.label));
      break;
    case "avatar":
      parts.push(quoteString(node.initials));
      break;
    case "spinner": {
      const sp = node;
      if (sp.label !== void 0) parts.push(quoteString(sp.label));
      break;
    }
    case "status":
      parts.push(quoteString(node.label));
      break;
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
  if (node.kind === "slot") {
    const slot = node;
    const kids = [...slot.children];
    if (slot.slotFooter) kids.push(slot.slotFooter);
    return kids;
  }
  if (node.kind === "navbar") {
    const navbar = node;
    const kids = [];
    if (navbar.leading) kids.push(navbar.leading);
    if (navbar.trailing) kids.push(navbar.trailing);
    return kids;
  }
  if (node.kind === "grid") return node.children;
  if (node.kind === "resource") return [];
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
  colFillMinWidth: 220,
  cellMinSize: 80,
  cellPadding: 8,
  resourceBarHeight: 28,
  resourceBarItemGap: 16,
  resourceBarIconSize: 18,
  statsGap: 18,
  progressDefaultWidth: 200,
  progressMaxWidth: 600,
  progressHeight: 18,
  chartDefaultWidth: 220,
  chartDefaultHeight: 120,
  annotationBg: "#fefcf3",
  annotationBorder: "#b8a26b",
  annotationText: "#3d3526",
  annotationLineColor: "#8a7a4f",
  annotationDotColor: "#8a7a4f",
  annotationStrokeWidth: 1,
  annotationDotRadius: 3,
  annotationCornerRadius: 4,
  annotationPaddingX: 12,
  annotationPaddingY: 8,
  annotationGap: 48,
  annotationMargin: 16,
  annotationStackGap: 8,
  treeIndent: 18,
  treeRowHeight: 22,
  treeIndentGuideColor: "#d8dadf",
  treeGlyphColor: "#6b7078",
  treeSelectedBg: "#e7edf5",
  treeSelectedText: "#2d2d2d",
  checkboxSize: 16,
  checkboxRowGap: 8,
  checkboxBorderColor: "#6b7078",
  checkboxFillColor: "#ffffff",
  checkboxCheckColor: "#2d2d2d",
  radioSize: 16,
  toggleWidth: 32,
  toggleHeight: 18,
  toggleOnColor: "#3a3a3a",
  toggleOffColor: "#c4c4c4",
  toggleKnobColor: "#ffffff",
  radioGroupGap: 14,
  menubarHeight: 28,
  menubarItemPaddingX: 12,
  menubarBgColor: "#f5f6f8",
  menubarBorderColor: "#c4c4c4",
  menuWidth: 200,
  menuItemHeight: 24,
  menuItemPaddingX: 12,
  menuBgColor: "#ffffff",
  menuBorderColor: "#8a8a8a",
  menuShortcutColor: "#8a9099",
  menuSeparatorColor: "#d8dadf",
  chipHeight: 22,
  chipPaddingX: 10,
  chipBg: "#eef0f3",
  chipBorder: "#c4c8ce",
  chipText: "#3a3e44",
  chipSelectedBg: "#3a3a3a",
  chipSelectedBorder: "#3a3a3a",
  chipSelectedText: "#ffffff",
  avatarSizeSmall: 24,
  avatarSizeMedium: 32,
  avatarSizeLarge: 44,
  avatarBg: "#e2e5ea",
  avatarBorder: "#b5b8bd",
  avatarText: "#3a3e44",
  breadcrumbHeight: 22,
  breadcrumbGap: 6,
  breadcrumbSeparatorColor: "#8a9099",
  breadcrumbCurrentColor: "#2d2d2d",
  spinnerSize: 16,
  spinnerColor: "#6b7078",
  statusHeight: 22,
  statusPaddingX: 10,
  statusColors: Object.freeze({
    success: { bg: "#e8f3ec", fg: "#205537", border: "#3f8f5c" },
    info: { bg: "#e7edf5", fg: "#234273", border: "#3f7cc2" },
    warning: { bg: "#f7efdc", fg: "#6b4e15", border: "#c79a2e" },
    error: { bg: "#f5e4e2", fg: "#5c2420", border: "#b0413c" }
  }),
  accents: Object.freeze({
    research: "#3f7cc2",
    military: "#b55442",
    industry: "#c28a3a",
    wealth: "#3f8f5c",
    approval: "#7a56b0",
    warning: "#c79a2e",
    danger: "#b0413c",
    success: "#3f8f5c"
  }),
  states: Object.freeze({
    locked: {
      border: "#b8b8b8",
      fill: "#f0f0f0",
      text: "#8a8f97",
      badge: "lock"
    },
    available: {
      border: "#7a7f87",
      fill: "#fafbfc",
      text: "#2d2d2d"
    },
    active: {
      border: "#3a3a3a",
      fill: "#fafbfc",
      text: "#2d2d2d"
    },
    purchased: {
      border: "#3f8f5c",
      fill: "#e8f3ec",
      text: "#205537",
      badge: "check"
    },
    maxed: {
      border: "#c28a3a",
      fill: "#f7efdc",
      text: "#6b4e15",
      badge: "star"
    },
    growing: {
      border: "#7a9a5a",
      fill: "#edf4e2",
      text: "#44552a"
    },
    ripe: {
      border: "#3f8f5c",
      fill: "#d9eedf",
      text: "#205537",
      badge: "check"
    },
    withering: {
      border: "#a07245",
      fill: "#f0e4d5",
      text: "#6b4e2e"
    },
    cashed: {
      border: "#b8b8b8",
      fill: "#ededed",
      text: "#7a7f87"
    }
  })
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
  iconStrokeColor: "#8a9099",
  annotationBg: "#2c2a22",
  annotationBorder: "#7a6a42",
  annotationText: "#e8dfc4",
  annotationLineColor: "#a8966a",
  annotationDotColor: "#a8966a",
  treeIndentGuideColor: "#404040",
  treeGlyphColor: "#8a9099",
  treeSelectedBg: "#2f3a4c",
  treeSelectedText: "#e0e0e0",
  checkboxBorderColor: "#8a9099",
  checkboxFillColor: "#252525",
  checkboxCheckColor: "#e0e0e0",
  toggleOnColor: "#d4d4d4",
  toggleOffColor: "#555555",
  toggleKnobColor: "#1e1e1e",
  menubarBgColor: "#2a2a2a",
  menubarBorderColor: "#555555",
  menuBgColor: "#252525",
  menuBorderColor: "#6b6b6b",
  menuShortcutColor: "#8a9099",
  menuSeparatorColor: "#404040",
  chipBg: "#353a42",
  chipBorder: "#555a62",
  chipText: "#b8bcc4",
  chipSelectedBg: "#d4d4d4",
  chipSelectedBorder: "#d4d4d4",
  chipSelectedText: "#1e1e1e",
  avatarBg: "#353a42",
  avatarBorder: "#555a62",
  avatarText: "#d4d4d4",
  breadcrumbSeparatorColor: "#707780",
  breadcrumbCurrentColor: "#f0f0f0",
  spinnerColor: "#8a9099",
  statusColors: Object.freeze({
    success: { bg: "#1f2e24", fg: "#b0e0c2", border: "#6bbd86" },
    info: { bg: "#1f2a3a", fg: "#b0c7e8", border: "#6ba4e8" },
    warning: { bg: "#3a2f1c", fg: "#f0d79a", border: "#e2aa57" },
    error: { bg: "#3a2220", fg: "#edb4ae", border: "#d66863" }
  }),
  accents: Object.freeze({
    research: "#6ba4e8",
    military: "#d47967",
    industry: "#e2aa57",
    wealth: "#6bbd86",
    approval: "#a58fd0",
    warning: "#e2b84a",
    danger: "#d66863",
    success: "#6bbd86"
  }),
  states: Object.freeze({
    locked: {
      border: "#5a5a5a",
      fill: "#2a2a2a",
      text: "#707780",
      badge: "lock"
    },
    available: {
      border: "#8a9099",
      fill: "#252525",
      text: "#e0e0e0"
    },
    active: {
      border: "#d4d4d4",
      fill: "#252525",
      text: "#f0f0f0"
    },
    purchased: {
      border: "#6bbd86",
      fill: "#1f2e24",
      text: "#b0e0c2",
      badge: "check"
    },
    maxed: {
      border: "#e2aa57",
      fill: "#3a2f1c",
      text: "#f0d79a",
      badge: "star"
    },
    growing: {
      border: "#9abb6f",
      fill: "#242d1c",
      text: "#c5d9a7"
    },
    ripe: {
      border: "#6bbd86",
      fill: "#1f3528",
      text: "#b0e0c2",
      badge: "check"
    },
    withering: {
      border: "#b58a5c",
      fill: "#332a22",
      text: "#d1b89a"
    },
    cashed: {
      border: "#5a5a5a",
      fill: "#2a2a2a",
      text: "#8a9099"
    }
  })
});
function getTheme(name) {
  return name === "dark" ? DARK_THEME : DEFAULT_THEME;
}

// src/renderer/layout.ts
function layout(doc, theme) {
  if (!doc.root) {
    return { canvasWidth: 0, canvasHeight: 0, root: emptyLaidOut(), annotations: [] };
  }
  const measured = measureWindow(doc.root, theme);
  const windowSize = measured.outer;
  const annotations = doc.annotations ?? [];
  if (annotations.length === 0) {
    const laidRoot2 = positionWindow(doc.root, measured, 0, 0, theme);
    return {
      canvasWidth: windowSize.width,
      canvasHeight: windowSize.height,
      root: laidRoot2,
      annotations: []
    };
  }
  const bySide = {
    left: [],
    right: [],
    top: [],
    bottom: []
  };
  for (const a of annotations) bySide[a.side].push(a);
  const measuredBoxes = /* @__PURE__ */ new Map();
  for (const a of annotations) {
    measuredBoxes.set(a, measureAnnotation(a, theme));
  }
  const marginLeft = sideMargin("left", bySide.left, measuredBoxes, theme);
  const marginRight = sideMargin("right", bySide.right, measuredBoxes, theme);
  const marginTop = sideMargin("top", bySide.top, measuredBoxes, theme);
  const marginBottom = sideMargin("bottom", bySide.bottom, measuredBoxes, theme);
  const topStackWidth = stackMainAxis("top", bySide.top, measuredBoxes, theme);
  const bottomStackWidth = stackMainAxis("bottom", bySide.bottom, measuredBoxes, theme);
  const contentWidth = Math.max(windowSize.width, topStackWidth, bottomStackWidth);
  const leftStackHeight = stackMainAxis("left", bySide.left, measuredBoxes, theme);
  const rightStackHeight = stackMainAxis("right", bySide.right, measuredBoxes, theme);
  const contentHeight = Math.max(windowSize.height, leftStackHeight, rightStackHeight);
  const canvasWidth = marginLeft + contentWidth + marginRight;
  const canvasHeight = marginTop + contentHeight + marginBottom;
  const windowX = marginLeft + (contentWidth - windowSize.width) / 2;
  const windowY = marginTop + (contentHeight - windowSize.height) / 2;
  const laidRoot = positionWindow(doc.root, measured, windowX, windowY, theme);
  const idMap = buildIdMap(laidRoot);
  const laidAnnotations = [];
  for (const side of ["left", "right", "top", "bottom"]) {
    const placed = placeAnnotationsOnSide(
      side,
      bySide[side],
      measuredBoxes,
      idMap,
      { x: windowX, y: windowY, width: windowSize.width, height: windowSize.height },
      canvasWidth,
      canvasHeight,
      theme
    );
    laidAnnotations.push(...placed);
  }
  return {
    canvasWidth,
    canvasHeight,
    root: laidRoot,
    annotations: laidAnnotations
  };
}
function emptyLaidOut() {
  return {
    node: {
      kind: "window",
      attributes: [],
      children: [],
      position: { line: 1, column: 1 }
    },
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    children: []
  };
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
    case "spacer":
      return measureSpacer();
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
    case "grid":
      return measureGrid(node, theme);
    case "resourcebar":
      return measureResourceBar(node, theme);
    case "stats":
      return measureStats(node, theme);
    case "progress":
      return measureProgress(node, theme);
    case "chart":
      return measureChart(node, theme);
    case "tree":
      return measureTree(node, theme);
    case "menubar":
      return measureMenubar(node, theme);
    case "menu":
      return measureMenu(node, theme);
    case "breadcrumb":
      return measureBreadcrumb(node, theme);
    case "checkbox":
      return measureCheckbox(node, theme);
    case "radio":
      return measureRadio(node, theme);
    case "toggle":
      return measureToggle(node, theme);
    case "chip":
      return measureChip(node, theme);
    case "avatar":
      return measureAvatar(node, theme);
    case "spinner":
      return measureSpinner(node, theme);
    case "status":
      return measureStatus(node, theme);
  }
}
function measureTree(node, theme) {
  let maxW = 0;
  let totalRows = 0;
  const walk = (n, depth) => {
    totalRows++;
    const labelW = n.label.length * theme.averageCharWidth;
    const rowW = depth * theme.treeIndent + theme.treeIndent + labelW;
    if (rowW > maxW) maxW = rowW;
    const collapsed = hasFlagAttr(n.attributes, "collapsed");
    if (!collapsed) {
      for (const child of n.children) walk(child, depth + 1);
    }
  };
  for (const n of node.children) walk(n, 0);
  return { width: maxW, height: totalRows * theme.treeRowHeight };
}
function measureMenubar(node, theme) {
  const totalW = node.children.reduce(
    (acc, m) => acc + m.label.length * theme.averageCharWidth + theme.menubarItemPaddingX * 2,
    0
  );
  return { width: totalW, height: theme.menubarHeight };
}
function measureMenu(node, theme) {
  let maxLabel = node.label.length * theme.averageCharWidth;
  let itemCount = 0;
  for (const c of node.children) {
    if (c.kind === "menuitem") {
      const shortcut = getAttrString(c.attributes, "shortcut");
      const rowW = c.label.length * theme.averageCharWidth + (shortcut ? shortcut.length * theme.averageCharWidth + 24 : 0);
      if (rowW > maxLabel) maxLabel = rowW;
      itemCount++;
    } else if (c.kind === "separator") {
      itemCount++;
    } else if (c.kind === "menu") {
      const rowW = c.label.length * theme.averageCharWidth + 24;
      if (rowW > maxLabel) maxLabel = rowW;
      itemCount++;
    }
  }
  const width = Math.max(theme.menuWidth, maxLabel + theme.menuItemPaddingX * 2);
  const height = itemCount * theme.menuItemHeight + 4;
  return { width, height };
}
function measureBreadcrumb(node, theme) {
  if (node.children.length === 0) return { width: 0, height: theme.breadcrumbHeight };
  const labels = node.children.map(
    (c) => c.label.length * theme.averageCharWidth + (getAttrString(c.attributes, "icon") ? theme.iconSize + 4 : 0)
  );
  const total = labels.reduce((a, b) => a + b, 0) + (node.children.length - 1) * (theme.breadcrumbGap * 2 + 8);
  return { width: total, height: theme.breadcrumbHeight };
}
function measureCheckbox(node, theme) {
  const labelW = node.label.length * theme.averageCharWidth;
  return {
    width: theme.checkboxSize + theme.checkboxRowGap + labelW,
    height: Math.max(theme.checkboxSize, theme.lineHeight)
  };
}
function measureRadio(node, theme) {
  const labelW = node.label.length * theme.averageCharWidth;
  return {
    width: theme.radioSize + theme.checkboxRowGap + labelW,
    height: Math.max(theme.radioSize, theme.lineHeight)
  };
}
function measureToggle(node, theme) {
  const labelW = node.label.length * theme.averageCharWidth;
  return {
    width: theme.toggleWidth + theme.checkboxRowGap + labelW,
    height: Math.max(theme.toggleHeight, theme.lineHeight)
  };
}
function measureChip(node, theme) {
  const labelW = node.label.length * theme.averageCharWidth;
  const iconExtra = getAttrString(node.attributes, "icon") ? 16 : 0;
  const closeExtra = hasFlagAttr(node.attributes, "closable") ? 16 : 0;
  return {
    width: labelW + iconExtra + closeExtra + theme.chipPaddingX * 2,
    height: theme.chipHeight
  };
}
function measureAvatar(node, theme) {
  const sizeName = getAttrIdent(node.attributes, "size") ?? "medium";
  const size = sizeName === "small" ? theme.avatarSizeSmall : sizeName === "large" ? theme.avatarSizeLarge : theme.avatarSizeMedium;
  return { width: size, height: size };
}
function measureSpinner(node, theme) {
  const labelW = node.label ? node.label.length * theme.averageCharWidth + theme.checkboxRowGap : 0;
  return {
    width: theme.spinnerSize + labelW,
    height: Math.max(theme.spinnerSize, theme.lineHeight)
  };
}
function measureStatus(node, theme) {
  const labelW = node.label.length * theme.averageCharWidth;
  return {
    width: labelW + 14 + theme.statusPaddingX * 2,
    // icon glyph + padding
    height: theme.statusHeight
  };
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
function measureSpacer() {
  return { width: 0, height: 0 };
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
  let footerH = 0;
  let footerW = 0;
  if (node.slotFooter) {
    const f = measureSlotFooter(node.slotFooter, theme);
    footerH = f.height + theme.colGap;
    footerW = f.width;
  }
  return {
    width: Math.max(inner.width, titleW, footerW) + theme.slotPadding * 2,
    height: theme.slotTitleHeight + theme.sectionTitlePaddingBottom + inner.height + footerH + theme.slotPadding * 2
  };
}
function measureSlotFooter(node, theme) {
  return measureStack(node.children, theme, "horizontal");
}
function measureGrid(node, theme) {
  const cellSize = preferredCellSize(node, theme);
  const width = node.cols * cellSize.width + (node.cols - 1) * theme.rowGap;
  const height = node.rows * cellSize.height + (node.rows - 1) * theme.colGap;
  return { width, height };
}
function preferredCellSize(node, theme) {
  let maxW = theme.cellMinSize;
  let maxH = theme.cellMinSize;
  for (const c of node.children) {
    const s = measureCell(c, theme);
    if (s.width > maxW) maxW = s.width;
    if (s.height > maxH) maxH = s.height;
  }
  return { width: maxW, height: maxH };
}
function measureCell(node, theme) {
  const inner = measureStack(node.children, theme, "vertical");
  const labelW = node.label ? node.label.length * theme.averageCharWidth : 0;
  const labelH = node.label ? theme.lineHeight : 0;
  return {
    width: Math.max(inner.width, labelW) + theme.cellPadding * 2,
    height: inner.height + labelH + theme.cellPadding * 2
  };
}
function measureResourceBar(node, theme) {
  if (node.children.length === 0) {
    return { width: 0, height: theme.resourceBarHeight };
  }
  const sizes = node.children.map((r) => measureResource(r, theme));
  const total = sizes.reduce((acc, s) => acc + s.width, 0) + (node.children.length - 1) * theme.resourceBarItemGap;
  return { width: total, height: theme.resourceBarHeight };
}
function measureResource(node, theme) {
  const text = `${node.name}: ${node.value}`;
  const textW = text.length * theme.averageCharWidth;
  return {
    width: theme.resourceBarIconSize + 6 + textW,
    height: theme.resourceBarHeight
  };
}
function measureStats(node, theme) {
  if (node.children.length === 0) return { width: 0, height: 0 };
  const sizes = node.children.map((s) => measureStat(s, theme));
  const total = sizes.reduce((acc, s) => acc + s.width, 0) + (node.children.length - 1) * theme.statsGap;
  const h = Math.max(...sizes.map((s) => s.height));
  return { width: total, height: h };
}
function measureStat(node, theme) {
  const labelW = node.label.length * theme.averageCharWidth * (theme.smallFontSize / theme.fontSize);
  const valueW = node.value.length * theme.averageCharWidth;
  return {
    width: labelW + 6 + valueW,
    height: theme.lineHeight
  };
}
function measureProgress(node, theme) {
  const label = getAttrString(node.attributes, "label");
  const labelH = label !== void 0 ? theme.smallFontSize + 4 : 0;
  return {
    width: theme.progressDefaultWidth,
    height: labelH + theme.progressHeight
  };
}
function measureChart(node, theme) {
  const width = getAttrNumber(node.attributes, "width") ?? theme.chartDefaultWidth;
  const height = getAttrNumber(node.attributes, "height") ?? theme.chartDefaultHeight;
  return { width, height };
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
  const { header, navbar, footer, bodyChildren } = classifyWindowChildren(node);
  const bodyStack = measureStack(bodyChildren, theme, "vertical");
  let bodyWidth = bodyStack.width;
  let bodyHeight = bodyStack.height;
  let headerHeight = 0;
  if (header) {
    const hs = measureHeaderOrFooter(header, theme, "header");
    headerHeight = hs.height;
    bodyWidth = Math.max(bodyWidth, hs.width);
  }
  let navbarHeight = 0;
  if (navbar) {
    const ns = measureNavbar(navbar, theme);
    navbarHeight = ns.height;
    bodyWidth = Math.max(bodyWidth, ns.width);
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
  const outerHeight = (hasTitleBar ? theme.titleBarHeight : 0) + headerHeight + navbarHeight + bodySize.height + footerHeight;
  return {
    outer: { width: outerWidth, height: outerHeight },
    body: bodySize,
    headerHeight,
    navbarHeight,
    footerHeight,
    hasTitleBar
  };
}
function measureNavbar(node, theme) {
  const leadingSize = node.leading ? measureStack(node.leading.children, theme, "horizontal") : { width: 0, height: 0 };
  const trailingSize = node.trailing ? measureStack(node.trailing.children, theme, "horizontal") : { width: 0, height: 0 };
  const innerHeight = Math.max(leadingSize.height, trailingSize.height, theme.buttonHeight);
  const minGap = leadingSize.width > 0 && trailingSize.width > 0 ? theme.rowGap : 0;
  return {
    width: leadingSize.width + trailingSize.width + minGap + theme.windowPadding * 2,
    height: innerHeight + theme.headerPaddingY * 2
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
  let navbar;
  let footer;
  const bodyChildren = [];
  for (const child of node.children) {
    if (child.kind === "header") header = child;
    else if (child.kind === "navbar") navbar = child;
    else if (child.kind === "footer") footer = child;
    else bodyChildren.push(child);
  }
  return { header, navbar, footer, bodyChildren };
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
  const { header, navbar, footer, bodyChildren } = classifyWindowChildren(node);
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
  if (navbar) {
    const laidNavbar = positionNavbar(navbar, x, cursorY, outerWidth, m.navbarHeight, theme);
    childrenLaid.push(laidNavbar);
    cursorY += m.navbarHeight;
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
function positionNavbar(node, x, y, width, height, theme) {
  const innerX = x + theme.windowPadding;
  const innerY = y + theme.headerPaddingY;
  const innerWidth = width - theme.windowPadding * 2;
  const innerHeight = height - theme.headerPaddingY * 2;
  const slotChildren = [];
  if (node.leading) {
    slotChildren.push(
      positionNavbarSlot(node.leading, innerX, innerY, innerHeight, theme, "left")
    );
  }
  if (node.trailing) {
    const trailingRight = innerX + innerWidth;
    slotChildren.push(
      positionNavbarSlot(node.trailing, trailingRight, innerY, innerHeight, theme, "right")
    );
  }
  return { node, x, y, width, height, children: slotChildren };
}
function positionNavbarSlot(node, anchorX, innerY, innerHeight, theme, anchor) {
  const sizes = node.children.map((c) => measureChild(c, theme));
  const totalChildWidth = sizes.reduce((acc, s) => acc + s.width, 0) + Math.max(0, node.children.length - 1) * theme.rowGap;
  let cursorX = anchor === "left" ? anchorX : anchorX - totalChildWidth;
  const slotX = cursorX;
  const childrenLaid = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const size = sizes[i];
    const childY = innerY + (innerHeight - size.height) / 2;
    childrenLaid.push(positionContainerChild(child, cursorX, childY, size.width, theme));
    cursorX += size.width;
    if (i < node.children.length - 1) cursorX += theme.rowGap;
  }
  return {
    node,
    x: slotX,
    y: innerY,
    width: totalChildWidth,
    height: innerHeight,
    children: childrenLaid
  };
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
    case "spacer":
      return positionSpacer(child, x, y, width);
    case "grid":
      return positionGrid(child, x, y, width, theme);
    case "resourcebar":
      return positionResourceBar(child, x, y, width, theme);
    case "stats":
      return positionStats(child, x, y, width, theme);
    case "progress":
      return positionProgress(child, x, y, width, theme);
    case "chart":
      return positionChart(child, x, y, theme);
    case "tree":
      return positionTree(child, x, y, width, theme);
    case "menubar":
      return positionMenubar(child, x, y, width, theme);
    case "menu":
      return positionMenu(child, x, y, width, theme);
    case "breadcrumb":
      return positionBreadcrumb(child, x, y, width, theme);
    case "checkbox":
      return positionLeaf(child, x, y, measureCheckbox(child, theme));
    case "radio":
      return positionLeaf(child, x, y, measureRadio(child, theme));
    case "toggle":
      return positionLeaf(child, x, y, measureToggle(child, theme));
    case "chip":
      return positionLeaf(child, x, y, measureChip(child, theme));
    case "avatar":
      return positionLeaf(child, x, y, measureAvatar(child, theme));
    case "spinner":
      return positionLeaf(child, x, y, measureSpinner(child, theme));
    case "status":
      return positionLeaf(child, x, y, measureStatus(child, theme));
  }
}
function positionLeaf(node, x, y, size) {
  return { node, x, y, width: size.width, height: size.height, children: [] };
}
function positionTree(node, x, y, width, theme) {
  const rows = [];
  const walk = (n, depth) => {
    const rowX = x + depth * theme.treeIndent;
    rows.push({
      node: n,
      x: rowX,
      y: y + rows.length * theme.treeRowHeight,
      width: width - depth * theme.treeIndent,
      height: theme.treeRowHeight,
      children: []
    });
    const collapsed = hasFlagAttr(n.attributes, "collapsed");
    if (!collapsed) {
      for (const c of n.children) walk(c, depth + 1);
    }
  };
  for (const n of node.children) walk(n, 0);
  const height = rows.length * theme.treeRowHeight;
  return { node, x, y, width, height, children: rows };
}
function positionMenubar(node, x, y, width, theme) {
  const children = [];
  let cursorX = x;
  for (const menu of node.children) {
    const w = menu.label.length * theme.averageCharWidth + theme.menubarItemPaddingX * 2;
    children.push({
      node: menu,
      x: cursorX,
      y,
      width: w,
      height: theme.menubarHeight,
      children: []
    });
    cursorX += w;
  }
  return { node, x, y, width, height: theme.menubarHeight, children };
}
function positionMenu(node, x, y, width, theme) {
  const size = measureMenu(node, theme);
  const children = [];
  let cursorY = y + 2;
  for (const c of node.children) {
    const rowH = theme.menuItemHeight;
    children.push({
      node: c,
      x: x + 2,
      y: cursorY,
      width: size.width - 4,
      height: rowH,
      children: []
    });
    cursorY += rowH;
  }
  return { node, x, y, width: size.width, height: size.height, children };
}
function positionBreadcrumb(node, x, y, width, theme) {
  const children = [];
  let cursorX = x;
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i];
    const iconW = getAttrString(c.attributes, "icon") ? theme.iconSize + 4 : 0;
    const w = iconW + c.label.length * theme.averageCharWidth;
    children.push({
      node: c,
      x: cursorX,
      y,
      width: w,
      height: theme.breadcrumbHeight,
      children: []
    });
    cursorX += w;
    if (i < node.children.length - 1) cursorX += theme.breadcrumbGap * 2 + 8;
  }
  return {
    node,
    x,
    y,
    width: cursorX - x,
    height: theme.breadcrumbHeight,
    children
  };
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
  let spacerCount = 0;
  for (const child of node.children) {
    if (child.kind === "col" && child.width.kind === "fill") {
      baseWidths.push(0);
      fillCount++;
    } else if (child.kind === "col" && child.width.kind === "length" && child.width.unit === "px") {
      baseWidths.push(child.width.value);
    } else if (child.kind === "spacer") {
      baseWidths.push(0);
      spacerCount++;
    } else {
      baseWidths.push(measureChild(child, theme).width);
    }
  }
  const gapTotal = Math.max(0, node.children.length - 1) * theme.rowGap;
  const fixedTotal = baseWidths.reduce((acc, w) => acc + w, 0);
  const available = Math.max(0, width - fixedTotal - gapTotal);
  const fillWidth = fillCount > 0 ? available / fillCount : 0;
  const spacerWidth = fillCount === 0 && spacerCount > 0 ? available / spacerCount : 0;
  const assignedWidths = node.children.map((child, i) => {
    if (child.kind === "col" && child.width.kind === "fill") {
      return Math.max(fillWidth, theme.colFillMinWidth);
    }
    if (child.kind === "spacer") {
      return Math.max(spacerWidth, 0);
    }
    return baseWidths[i] ?? 0;
  });
  const effectiveWidth = assignedWidths.reduce((acc, w) => acc + w, 0) + gapTotal;
  const justify = getJustify(node.attributes);
  const align = getAlign(node.attributes);
  const justifyActive = fillCount === 0 && spacerCount === 0 && justify !== "start";
  const slack = Math.max(0, width - effectiveWidth);
  let cursorX;
  let extraGapBetween = 0;
  if (fillCount > 0 || spacerCount > 0) {
    cursorX = x;
  } else if (justifyActive) {
    const n = node.children.length;
    if (justify === "end") {
      cursorX = x + slack;
    } else if (justify === "between") {
      cursorX = x;
      extraGapBetween = n > 1 ? slack / (n - 1) : 0;
    } else {
      const unit = n > 0 ? slack / (2 * n) : 0;
      cursorX = x + unit;
      extraGapBetween = 2 * unit;
    }
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
    if (i < node.children.length - 1) cursorX += theme.rowGap + extraGapBetween;
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
  if (node.slotFooter) {
    cursorY += theme.colGap;
    const laidFooter = positionSlotFooter(
      node.slotFooter,
      innerX,
      cursorY,
      innerWidth,
      theme
    );
    children.push(laidFooter);
    cursorY += laidFooter.height;
  }
  const height = cursorY - y + theme.slotPadding;
  return { node, x, y, width, height, children };
}
function positionSlotFooter(node, x, y, width, theme) {
  const sizes = node.children.map((c) => measureChild(c, theme));
  const totalWidth = sizes.reduce((acc, s) => acc + s.width, 0) + Math.max(0, node.children.length - 1) * theme.rowGap;
  let cursorX = x + width - totalWidth;
  const children = [];
  let maxH = 0;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const size = sizes[i];
    const laid = positionContainerChild(child, cursorX, y, size.width, theme);
    children.push(laid);
    if (laid.height > maxH) maxH = laid.height;
    cursorX += size.width + theme.rowGap;
  }
  return { node, x, y, width, height: maxH, children };
}
function positionGrid(node, x, y, width, theme) {
  const cellSize = preferredCellSize(node, theme);
  const children = [];
  const claimed = /* @__PURE__ */ new Set();
  for (const c of node.children) {
    if (c.row !== void 0 && c.col !== void 0) {
      claimed.add(`${c.row}:${c.col}`);
    }
  }
  let flowRow = 1;
  let flowCol = 1;
  const advanceFlow = () => {
    while (true) {
      if (flowCol > node.cols) {
        flowCol = 1;
        flowRow++;
      }
      if (flowRow > node.rows) return;
      if (!claimed.has(`${flowRow}:${flowCol}`)) return;
      flowCol++;
    }
  };
  for (const cell of node.children) {
    let r = cell.row;
    let c = cell.col;
    if (r === void 0 || c === void 0) {
      advanceFlow();
      r = flowRow;
      c = flowCol;
      flowCol++;
    }
    const clampedR = Math.min(Math.max(1, r), node.rows);
    const clampedC = Math.min(Math.max(1, c), node.cols);
    const cellX = x + (clampedC - 1) * (cellSize.width + theme.rowGap);
    const cellY = y + (clampedR - 1) * (cellSize.height + theme.colGap);
    children.push(positionCell(cell, cellX, cellY, cellSize.width, cellSize.height, theme));
  }
  return {
    node,
    x,
    y,
    width: node.cols * cellSize.width + (node.cols - 1) * theme.rowGap,
    height: node.rows * cellSize.height + (node.rows - 1) * theme.colGap,
    children
  };
}
function positionCell(node, x, y, width, height, theme) {
  const innerX = x + theme.cellPadding;
  const innerWidth = width - theme.cellPadding * 2;
  let cursorY = y + theme.cellPadding;
  if (node.label !== void 0) {
    cursorY += theme.lineHeight;
  }
  const children = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const laid = positionContainerChild(child, innerX, cursorY, innerWidth, theme);
    children.push(laid);
    cursorY += laid.height;
    if (i < node.children.length - 1) cursorY += theme.colGap;
  }
  return { node, x, y, width, height, children };
}
function positionResourceBar(node, x, y, width, theme) {
  const sizes = node.children.map((r) => measureResource(r, theme));
  const children = [];
  let cursorX = x;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const size = sizes[i];
    children.push({
      node: child,
      x: cursorX,
      y,
      width: size.width,
      height: size.height,
      children: []
    });
    cursorX += size.width + theme.resourceBarItemGap;
  }
  return {
    node,
    x,
    y,
    width: cursorX - x - (node.children.length > 0 ? theme.resourceBarItemGap : 0),
    height: theme.resourceBarHeight,
    children
  };
}
function positionStats(node, x, y, width, theme) {
  const sizes = node.children.map((s) => measureStat(s, theme));
  const children = [];
  let cursorX = x;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const size = sizes[i];
    children.push({
      node: child,
      x: cursorX,
      y,
      width: size.width,
      height: size.height,
      children: []
    });
    cursorX += size.width + theme.statsGap;
  }
  const used = node.children.length > 0 ? cursorX - x - theme.statsGap : 0;
  return { node, x, y, width: used, height: theme.lineHeight, children };
}
function positionProgress(node, x, y, width, theme) {
  const size = measureProgress(node, theme);
  const w = Math.max(size.width, Math.min(width, theme.progressMaxWidth));
  return { node, x, y, width: w, height: size.height, children: [] };
}
function positionChart(node, x, y, theme) {
  const size = measureChart(node, theme);
  return { node, x, y, width: size.width, height: size.height, children: [] };
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
function positionSpacer(node, x, y, width) {
  return { node, x, y, width, height: 0, children: [] };
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
function hasFlagAttr(attrs, flag) {
  for (const a of attrs) {
    const attr = a;
    if (attr.kind === "flag" && attr.flag === flag) return true;
  }
  return false;
}
function getAlign(attrs) {
  const v = getAttrIdent(attrs, "align");
  if (v === "center" || v === "right" || v === "left") return v;
  return "left";
}
function getJustify(attrs) {
  const v = getAttrIdent(attrs, "justify");
  if (v === "between" || v === "around" || v === "end" || v === "start") return v;
  return "start";
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
function measureAnnotation(node, theme) {
  const lines = node.body.split("\n");
  const contentWidth = Math.max(...lines.map((l) => l.length * theme.averageCharWidth));
  const width = contentWidth + theme.annotationPaddingX * 2;
  const height = lines.length * theme.lineHeight + theme.annotationPaddingY * 2;
  return { width, height, lines };
}
function sideMargin(side, list, measured, theme) {
  if (list.length === 0) return 0;
  if (side === "left" || side === "right") {
    const maxW = Math.max(...list.map((a) => measured.get(a).width));
    return maxW + theme.annotationGap + theme.annotationMargin;
  }
  const maxH = Math.max(...list.map((a) => measured.get(a).height));
  return maxH + theme.annotationGap + theme.annotationMargin;
}
function stackMainAxis(side, list, measured, theme) {
  if (list.length === 0) return 0;
  const dims = list.map((a) => measured.get(a));
  const gapTotal = (list.length - 1) * theme.annotationStackGap;
  if (side === "left" || side === "right") {
    return dims.reduce((acc, d) => acc + d.height, 0) + gapTotal;
  }
  return dims.reduce((acc, d) => acc + d.width, 0) + gapTotal;
}
function buildIdMap(root) {
  const out = /* @__PURE__ */ new Map();
  const stack = [root];
  while (stack.length > 0) {
    const n = stack.pop();
    const id = getAttrString(n.node.attributes ?? [], "id");
    if (id !== void 0 && !out.has(id)) {
      out.set(id, { x: n.x, y: n.y, width: n.width, height: n.height });
    }
    for (const c of n.children) stack.push(c);
  }
  return out;
}
function placeAnnotationsOnSide(side, list, measured, idMap, windowRect, canvasWidth, canvasHeight, theme) {
  if (list.length === 0) return [];
  const pending = [];
  for (const a of list) {
    const target = idMap.get(a.target);
    if (!target) continue;
    const dims = measured.get(a);
    let pref;
    if (side === "left" || side === "right") {
      pref = target.y + target.height / 2 - dims.height / 2;
    } else {
      pref = target.x + target.width / 2 - dims.width / 2;
    }
    pending.push({ node: a, dims, target, pref });
  }
  if (pending.length === 0) return [];
  pending.sort((a, b) => a.pref - b.pref);
  const mainSize = (p) => side === "left" || side === "right" ? p.dims.height : p.dims.width;
  const axisMin = side === "left" || side === "right" ? 0 : 0;
  const axisMax = side === "left" || side === "right" ? canvasHeight : canvasWidth;
  let cursor = -Infinity;
  for (const p of pending) {
    const minStart = cursor === -Infinity ? axisMin : cursor + theme.annotationStackGap;
    const start = Math.max(p.pref, minStart);
    cursor = start + mainSize(p);
    p.pref = start;
  }
  if (cursor > axisMax) {
    const overflow = cursor - axisMax;
    for (const p of pending) p.pref -= overflow;
  }
  const out = [];
  for (const p of pending) {
    const { node, dims, target } = p;
    let boxX;
    let boxY;
    let boxAnchor;
    let targetAnchor;
    if (side === "right") {
      boxX = windowRect.x + windowRect.width + theme.annotationGap;
      boxY = p.pref;
      boxAnchor = { x: boxX, y: boxY + dims.height / 2 };
      targetAnchor = {
        x: target.x + target.width,
        y: target.y + target.height / 2
      };
    } else if (side === "left") {
      boxX = windowRect.x - theme.annotationGap - dims.width;
      boxY = p.pref;
      boxAnchor = { x: boxX + dims.width, y: boxY + dims.height / 2 };
      targetAnchor = { x: target.x, y: target.y + target.height / 2 };
    } else if (side === "top") {
      boxX = p.pref;
      boxY = windowRect.y - theme.annotationGap - dims.height;
      boxAnchor = { x: boxX + dims.width / 2, y: boxY + dims.height };
      targetAnchor = { x: target.x + target.width / 2, y: target.y };
    } else {
      boxX = p.pref;
      boxY = windowRect.y + windowRect.height + theme.annotationGap;
      boxAnchor = { x: boxX + dims.width / 2, y: boxY };
      targetAnchor = {
        x: target.x + target.width / 2,
        y: target.y + target.height
      };
    }
    out.push({
      node,
      x: boxX,
      y: boxY,
      width: dims.width,
      height: dims.height,
      lines: dims.lines,
      boxAnchor,
      targetAnchor
    });
  }
  return out;
}

// src/renderer/icons.ts
var ICON_PATHS = {
  // Economy / wealth
  credits: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4" /><text x="8" y="11.3" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="currentColor">$</text>',
  // Research / science
  research: '<path d="M 6 2 L 6 6 L 3 13 Q 3 14 4 14 L 12 14 Q 13 14 13 13 L 10 6 L 10 2 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /><line x1="5.5" y1="2" x2="10.5" y2="2" stroke="currentColor" stroke-width="1.4" />',
  // Military / combat
  military: '<path d="M 8 2 L 13 4 L 13 8 Q 13 12 8 14 Q 3 12 3 8 L 3 4 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />',
  // Industry / production
  industry: '<path d="M 2 14 L 2 8 L 7 10 L 7 7 L 12 10 L 12 4 L 14 4 L 14 14 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />',
  // Influence / speech
  influence: '<path d="M 3 4 L 13 4 Q 14 4 14 5 L 14 10 Q 14 11 13 11 L 8 11 L 5 14 L 5 11 L 3 11 Q 2 11 2 10 L 2 5 Q 2 4 3 4 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />',
  // Approval / loyalty (simple heart)
  approval: '<path d="M 8 14 Q 2 10 2 6 Q 2 3 5 3 Q 7 3 8 5 Q 9 3 11 3 Q 14 3 14 6 Q 14 10 8 14 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />',
  // Faith / ideology
  faith: '<path d="M 8 2 L 9.6 6.5 L 14 6.5 L 10.5 9.2 L 11.8 14 L 8 11.2 L 4.2 14 L 5.5 9.2 L 2 6.5 L 6.4 6.5 Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />',
  // Authority / admin
  authority: '<path d="M 3 14 L 3 5 L 5 5 L 5 3 L 11 3 L 11 5 L 13 5 L 13 14 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /><line x1="8" y1="5" x2="8" y2="14" stroke="currentColor" stroke-width="1" />',
  // Computation / AI compute
  computation: '<rect x="4" y="4" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" /><line x1="2" y1="6" x2="4" y2="6" stroke="currentColor" stroke-width="1" /><line x1="2" y1="10" x2="4" y2="10" stroke="currentColor" stroke-width="1" /><line x1="12" y1="6" x2="14" y2="6" stroke="currentColor" stroke-width="1" /><line x1="12" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1" /><line x1="6" y1="2" x2="6" y2="4" stroke="currentColor" stroke-width="1" /><line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" stroke-width="1" /><line x1="6" y1="12" x2="6" y2="14" stroke="currentColor" stroke-width="1" /><line x1="10" y1="12" x2="10" y2="14" stroke="currentColor" stroke-width="1" />',
  // Tech / research tree node
  tech: '<polygon points="8,2 14,6 14,10 8,14 2,10 2,6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /><circle cx="8" cy="8" r="2" fill="currentColor" />',
  // Policy / document
  policy: '<path d="M 4 2 L 11 2 L 13 4 L 13 14 L 4 14 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /><line x1="6" y1="7" x2="11" y2="7" stroke="currentColor" stroke-width="1" /><line x1="6" y1="10" x2="11" y2="10" stroke="currentColor" stroke-width="1" />',
  // Ship
  ship: '<path d="M 2 10 L 14 10 L 12 14 L 4 14 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /><line x1="8" y1="2" x2="8" y2="10" stroke="currentColor" stroke-width="1.4" /><path d="M 8 3 L 12 7 L 8 7 Z" fill="currentColor" />',
  // Planet
  planet: '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.4" /><ellipse cx="8" cy="8" rx="7" ry="2" fill="none" stroke="currentColor" stroke-width="1" transform="rotate(-20 8 8)" />',
  // Leader / person
  leader: '<circle cx="8" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.4" /><path d="M 3 14 Q 3 9 8 9 Q 13 9 13 14 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />',
  // Gear
  gear: '<path d="M 8 2 L 9 3.5 L 11 3 L 11.5 5 L 13 6 L 12.5 8 L 13 10 L 11.5 11 L 11 13 L 9 12.5 L 8 14 L 7 12.5 L 5 13 L 4.5 11 L 3 10 L 3.5 8 L 3 6 L 4.5 5 L 5 3 L 7 3.5 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /><circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.2" />',
  // Warning
  warning: '<path d="M 8 2 L 14 13 L 2 13 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /><line x1="8" y1="6" x2="8" y2="9" stroke="currentColor" stroke-width="1.6" /><circle cx="8" cy="11" r="0.8" fill="currentColor" />',
  // Lock
  lock: '<rect x="3.5" y="7" width="9" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" /><path d="M 5.5 7 L 5.5 5 Q 5.5 2.5 8 2.5 Q 10.5 2.5 10.5 5 L 10.5 7" fill="none" stroke="currentColor" stroke-width="1.4" />',
  // Check
  check: '<path d="M 3 8 L 7 12 L 13 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />',
  // Star
  star: '<path d="M 8 2 L 9.6 6.5 L 14 6.5 L 10.5 9.2 L 11.8 14 L 8 11.2 L 4.2 14 L 5.5 9.2 L 2 6.5 L 6.4 6.5 Z" fill="currentColor" stroke="none" />',
  // Plus / minus (handy extras for UI chrome)
  plus: '<line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />',
  minus: '<line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />'
};
function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICON_PATHS, name);
}
function emitIconByName(name, x, y, size, color) {
  const body = ICON_PATHS[name];
  if (body === void 0) return void 0;
  const scale = size / 16;
  return `<g transform="translate(${x} ${y}) scale(${scale})" color="${color}">` + body + `</g>`;
}

// src/renderer/svg.ts
function emitSvg(doc, theme, options = {}) {
  const parts = [];
  const width = doc.canvasWidth;
  const height = doc.canvasHeight;
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
  emitNode(doc.root, theme, parts);
  for (const a of doc.annotations) {
    emitAnnotation(a, theme, parts);
  }
  parts.push("</svg>");
  return parts.join("");
}
function emitAnnotation(a, theme, out) {
  out.push(
    `<line x1="${a.targetAnchor.x}" y1="${a.targetAnchor.y}" x2="${a.boxAnchor.x}" y2="${a.boxAnchor.y}" stroke="${theme.annotationLineColor}" stroke-width="${theme.annotationStrokeWidth}" />`
  );
  out.push(
    `<circle cx="${a.targetAnchor.x}" cy="${a.targetAnchor.y}" r="${theme.annotationDotRadius}" fill="${theme.annotationDotColor}" />`
  );
  out.push(
    `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" rx="${theme.annotationCornerRadius}" ry="${theme.annotationCornerRadius}" fill="${theme.annotationBg}" stroke="${theme.annotationBorder}" stroke-width="${theme.annotationStrokeWidth}" />`
  );
  const textX = a.x + theme.annotationPaddingX;
  let baseline = a.y + theme.annotationPaddingY + theme.fontSize;
  for (const line of a.lines) {
    out.push(
      `<text x="${textX}" y="${baseline}" fill="${theme.annotationText}">${escapeText(line)}</text>`
    );
    baseline += theme.lineHeight;
  }
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
    case "navbar":
      emitNavbar(laid, theme, out);
      break;
    case "navbarLeading":
    case "navbarTrailing":
      for (const c of laid.children) emitNode(c, theme, out);
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
    case "spacer":
      break;
    case "grid":
      emitGrid(laid, theme, out);
      break;
    case "cell":
      emitCell(laid, theme, out);
      break;
    case "resourcebar":
      emitResourceBar(laid, theme, out);
      break;
    case "resource":
      emitResource(laid, theme, out);
      break;
    case "stats":
      emitStats(laid, theme, out);
      break;
    case "stat":
      emitStat(laid, theme, out);
      break;
    case "progress":
      emitProgress(laid, theme, out);
      break;
    case "chart":
      emitChart(laid, theme, out);
      break;
    case "slotFooter":
      for (const c of laid.children) emitNode(c, theme, out);
      break;
    case "tree":
      emitTree(laid, theme, out);
      break;
    case "treeNode":
      emitTreeNode(laid, theme, out);
      break;
    case "menubar":
      emitMenubar(laid, theme, out);
      break;
    case "menu":
      emitMenu(laid, theme, out);
      break;
    case "menuitem":
      emitMenuItem(laid, theme, out);
      break;
    case "separator":
      emitMenuSeparator(laid, theme, out);
      break;
    case "breadcrumb":
      emitBreadcrumb(laid, theme, out);
      break;
    case "crumb":
      break;
    case "checkbox":
      emitCheckbox(laid, theme, out);
      break;
    case "radio":
      emitRadio(laid, theme, out);
      break;
    case "toggle":
      emitToggle(laid, theme, out);
      break;
    case "chip":
      emitChip(laid, theme, out);
      break;
    case "avatar":
      emitAvatar(laid, theme, out);
      break;
    case "spinner":
      emitSpinner(laid, theme, out);
      break;
    case "status":
      emitStatus(laid, theme, out);
      break;
  }
}
function emitTree(laid, theme, out) {
  for (const row of laid.children) {
    emitNode(row, theme, out);
  }
}
function emitTreeNode(laid, theme, out) {
  const node = laid.node;
  const isSelected = hasFlag(node.attributes, "selected");
  const isCollapsed = hasFlag(node.attributes, "collapsed");
  const hasChildren = node.children.length > 0;
  const iconName = getAttrString2(node.attributes, "icon");
  if (isSelected) {
    out.push(
      `<rect x="${laid.x}" y="${laid.y}" width="${laid.width}" height="${laid.height}" fill="${theme.treeSelectedBg}" rx="2" />`
    );
  }
  let cursorX = laid.x + 4;
  const midY = laid.y + laid.height / 2;
  if (hasChildren) {
    const glyph = isCollapsed ? "\u25B8" : "\u25BE";
    out.push(
      `<text x="${cursorX}" y="${midY + theme.fontSize / 3}" font-size="${theme.smallFontSize}" fill="${theme.treeGlyphColor}">${glyph}</text>`
    );
  }
  cursorX += 12;
  if (iconName && hasIcon(iconName)) {
    const iconSize = 14;
    const iconMarkup = emitIconByName(
      iconName,
      cursorX,
      midY - iconSize / 2,
      iconSize,
      theme.iconStrokeColor
    );
    if (iconMarkup) out.push(iconMarkup);
    cursorX += iconSize + 4;
  }
  const textFill = isSelected ? theme.treeSelectedText : theme.textColor;
  out.push(
    `<text x="${cursorX}" y="${midY + theme.fontSize / 3}" fill="${textFill}">${escapeText(node.label)}</text>`
  );
}
function emitMenubar(laid, theme, out) {
  out.push(
    `<rect x="${laid.x}" y="${laid.y}" width="${laid.width}" height="${laid.height}" fill="${theme.menubarBgColor}" stroke="${theme.menubarBorderColor}" stroke-width="1" />`
  );
  for (const m of laid.children) {
    const menu = m.node;
    out.push(
      `<text x="${m.x + theme.menubarItemPaddingX}" y="${m.y + m.height / 2 + theme.fontSize / 3}" fill="${theme.textColor}">${escapeText(menu.label)}</text>`
    );
  }
}
function emitMenu(laid, theme, out) {
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${theme.menuBgColor}" stroke="${theme.menuBorderColor}" stroke-width="1" rx="3" />`
  );
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitMenuItem(laid, theme, out) {
  const node = laid.node;
  const isDisabled = hasFlag(node.attributes, "disabled");
  const opacity = isDisabled ? "0.5" : "1";
  const midY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${laid.x + theme.menuItemPaddingX}" y="${midY}" opacity="${opacity}" fill="${theme.textColor}">${escapeText(node.label)}</text>`
  );
  const shortcut = getAttrString2(node.attributes, "shortcut");
  if (shortcut !== void 0) {
    out.push(
      `<text x="${laid.x + laid.width - theme.menuItemPaddingX}" y="${midY}" text-anchor="end" opacity="${opacity}" font-size="${theme.smallFontSize}" fill="${theme.menuShortcutColor}">${escapeText(shortcut)}</text>`
    );
  }
}
function emitMenuSeparator(laid, theme, out) {
  const midY = laid.y + laid.height / 2;
  out.push(
    `<line x1="${laid.x + 4}" y1="${midY}" x2="${laid.x + laid.width - 4}" y2="${midY}" stroke="${theme.menuSeparatorColor}" stroke-width="1" />`
  );
}
function emitBreadcrumb(laid, theme, out) {
  const crumbs = laid.children;
  for (let i = 0; i < crumbs.length; i++) {
    const c = crumbs[i];
    const isLast = i === crumbs.length - 1;
    const node = c.node;
    const iconName = getAttrString2(node.attributes, "icon");
    let labelX = c.x;
    const midY = c.y + c.height / 2 + theme.fontSize / 3;
    if (iconName && hasIcon(iconName)) {
      const iconSize = 14;
      const iconMarkup = emitIconByName(
        iconName,
        c.x,
        c.y + (c.height - iconSize) / 2,
        iconSize,
        theme.iconStrokeColor
      );
      if (iconMarkup) out.push(iconMarkup);
      labelX += iconSize + 4;
    }
    const fill = isLast ? theme.breadcrumbCurrentColor : theme.mutedTextColor;
    const weight = isLast ? "600" : "400";
    out.push(
      `<text x="${labelX}" y="${midY}" font-weight="${weight}" fill="${fill}">${escapeText(node.label)}</text>`
    );
    if (!isLast) {
      const chevX = c.x + c.width + theme.breadcrumbGap;
      out.push(
        `<text x="${chevX}" y="${midY}" fill="${theme.breadcrumbSeparatorColor}">\u203A</text>`
      );
    }
  }
}
function emitCheckbox(laid, theme, out) {
  const node = laid.node;
  const checked = hasFlag(node.attributes, "checked");
  const disabled = hasFlag(node.attributes, "disabled");
  const labelRight = !hasFlag(node.attributes, "label-right") ? false : true;
  const opacity = disabled ? "0.5" : "1";
  const size = theme.checkboxSize;
  const cy = laid.y + laid.height / 2 - size / 2;
  let controlX;
  let labelX;
  if (labelRight) {
    controlX = laid.x;
    labelX = controlX + size + theme.checkboxRowGap;
  } else {
    labelX = laid.x;
    controlX = laid.x + laid.width - size;
  }
  out.push(`<g opacity="${opacity}">`);
  out.push(
    `<rect x="${controlX + 0.5}" y="${cy + 0.5}" width="${size - 1}" height="${size - 1}" rx="2" fill="${theme.checkboxFillColor}" stroke="${theme.checkboxBorderColor}" stroke-width="1.2" />`
  );
  if (checked) {
    out.push(
      `<path d="M ${controlX + size * 0.22} ${cy + size * 0.52} L ${controlX + size * 0.45} ${cy + size * 0.74} L ${controlX + size * 0.8} ${cy + size * 0.28}" fill="none" stroke="${theme.checkboxCheckColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`
    );
  }
  const midY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${labelX}" y="${midY}" fill="${theme.textColor}">${escapeText(node.label)}</text>`
  );
  out.push(`</g>`);
}
function emitRadio(laid, theme, out) {
  const node = laid.node;
  const selected = hasFlag(node.attributes, "selected");
  const disabled = hasFlag(node.attributes, "disabled");
  const labelRight = hasFlag(node.attributes, "label-right");
  const opacity = disabled ? "0.5" : "1";
  const size = theme.radioSize;
  const cy = laid.y + laid.height / 2;
  let controlCx;
  let labelX;
  if (labelRight) {
    controlCx = laid.x + size / 2;
    labelX = laid.x + size + theme.checkboxRowGap;
  } else {
    labelX = laid.x;
    controlCx = laid.x + laid.width - size / 2;
  }
  out.push(`<g opacity="${opacity}">`);
  out.push(
    `<circle cx="${controlCx}" cy="${cy}" r="${size / 2 - 0.5}" fill="${theme.checkboxFillColor}" stroke="${theme.checkboxBorderColor}" stroke-width="1.2" />`
  );
  if (selected) {
    out.push(
      `<circle cx="${controlCx}" cy="${cy}" r="${size / 4}" fill="${theme.checkboxCheckColor}" />`
    );
  }
  const midY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${labelX}" y="${midY}" fill="${theme.textColor}">${escapeText(node.label)}</text>`
  );
  out.push(`</g>`);
}
function emitToggle(laid, theme, out) {
  const node = laid.node;
  const on = hasFlag(node.attributes, "on") && !hasFlag(node.attributes, "off");
  const disabled = hasFlag(node.attributes, "disabled");
  const labelRight = hasFlag(node.attributes, "label-right");
  const opacity = disabled ? "0.5" : "1";
  const w = theme.toggleWidth;
  const h = theme.toggleHeight;
  const cy = laid.y + laid.height / 2 - h / 2;
  let controlX;
  let labelX;
  if (labelRight) {
    controlX = laid.x;
    labelX = laid.x + w + theme.checkboxRowGap;
  } else {
    labelX = laid.x;
    controlX = laid.x + laid.width - w;
  }
  const fill = on ? theme.toggleOnColor : theme.toggleOffColor;
  const knobR = h / 2 - 2;
  const knobCx = on ? controlX + w - knobR - 2 : controlX + knobR + 2;
  out.push(`<g opacity="${opacity}">`);
  out.push(
    `<rect x="${controlX}" y="${cy}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" />`
  );
  out.push(
    `<circle cx="${knobCx}" cy="${cy + h / 2}" r="${knobR}" fill="${theme.toggleKnobColor}" />`
  );
  const midY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${labelX}" y="${midY}" fill="${theme.textColor}">${escapeText(node.label)}</text>`
  );
  out.push(`</g>`);
}
function emitChip(laid, theme, out) {
  const node = laid.node;
  const selected = hasFlag(node.attributes, "selected");
  const closable = hasFlag(node.attributes, "closable");
  const accent = getAccent(node.attributes, theme);
  const iconName = getAttrString2(node.attributes, "icon");
  let bg;
  let border;
  let textColor;
  if (selected) {
    bg = accent ?? theme.chipSelectedBg;
    border = accent ?? theme.chipSelectedBorder;
    textColor = theme.chipSelectedText;
  } else {
    bg = theme.chipBg;
    border = accent ?? theme.chipBorder;
    textColor = accent ?? theme.chipText;
  }
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" rx="${laid.height / 2}" fill="${bg}" stroke="${border}" stroke-width="1" />`
  );
  let cursorX = laid.x + theme.chipPaddingX;
  const midY = laid.y + laid.height / 2;
  if (iconName && hasIcon(iconName)) {
    const iconSize = 12;
    const iconMarkup = emitIconByName(
      iconName,
      cursorX,
      midY - iconSize / 2,
      iconSize,
      textColor
    );
    if (iconMarkup) out.push(iconMarkup);
    cursorX += iconSize + 4;
  }
  out.push(
    `<text x="${cursorX}" y="${midY + theme.fontSize / 3}" font-size="${theme.smallFontSize}" fill="${textColor}">${escapeText(node.label)}</text>`
  );
  if (closable) {
    const cx = laid.x + laid.width - theme.chipPaddingX - 4;
    out.push(
      `<line x1="${cx - 4}" y1="${midY - 4}" x2="${cx + 4}" y2="${midY + 4}" stroke="${textColor}" stroke-width="1.2" stroke-linecap="round" />`,
      `<line x1="${cx + 4}" y1="${midY - 4}" x2="${cx - 4}" y2="${midY + 4}" stroke="${textColor}" stroke-width="1.2" stroke-linecap="round" />`
    );
  }
}
function emitAvatar(laid, theme, out) {
  const node = laid.node;
  const accent = getAccent(node.attributes, theme);
  const bg = accent ?? theme.avatarBg;
  const border = accent ?? theme.avatarBorder;
  const text = accent ? "#ffffff" : theme.avatarText;
  const cx = laid.x + laid.width / 2;
  const cy = laid.y + laid.height / 2;
  const r = laid.width / 2 - 0.5;
  out.push(
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="${border}" stroke-width="1" />`
  );
  const initials = (node.initials || "?").slice(0, 2).toUpperCase();
  const fontSize = Math.max(10, Math.round(laid.width * 0.42));
  out.push(
    `<text x="${cx}" y="${cy + fontSize / 3}" text-anchor="middle" font-size="${fontSize}" font-weight="600" fill="${text}">${escapeText(initials)}</text>`
  );
}
function emitSpinner(laid, theme, out) {
  const node = laid.node;
  const cx = laid.x + theme.spinnerSize / 2;
  const cy = laid.y + laid.height / 2;
  const r = theme.spinnerSize / 2 - 2;
  out.push(
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${theme.spinnerColor}" stroke-width="1.6" stroke-dasharray="${r * 1.3} ${r * 0.9}" stroke-linecap="round" />`
  );
  if (node.label !== void 0) {
    out.push(
      `<text x="${laid.x + theme.spinnerSize + theme.rowGap}" y="${cy + theme.fontSize / 3}" font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">${escapeText(node.label)}</text>`
    );
  }
}
function emitStatus(laid, theme, out) {
  const node = laid.node;
  const kindRaw = getAttrIdent2(node.attributes, "kind") ?? "info";
  const kind = ["success", "info", "warning", "error"].includes(
    kindRaw
  ) ? kindRaw : "info";
  const style = theme.statusColors[kind];
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" rx="${laid.height / 2}" fill="${style.bg}" stroke="${style.border}" stroke-width="1" />`
  );
  const glyphX = laid.x + theme.statusPaddingX;
  const midY = laid.y + laid.height / 2;
  if (kind === "success") {
    out.push(
      `<path d="M ${glyphX} ${midY} L ${glyphX + 4} ${midY + 4} L ${glyphX + 10} ${midY - 4}" fill="none" stroke="${style.border}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`
    );
  } else if (kind === "warning") {
    out.push(
      `<path d="M ${glyphX + 5} ${midY - 5} L ${glyphX + 10} ${midY + 4} L ${glyphX} ${midY + 4} Z" fill="none" stroke="${style.border}" stroke-width="1.4" stroke-linejoin="round" />`,
      `<line x1="${glyphX + 5}" y1="${midY - 1}" x2="${glyphX + 5}" y2="${midY + 2}" stroke="${style.border}" stroke-width="1.4" stroke-linecap="round" />`
    );
  } else if (kind === "error") {
    out.push(
      `<line x1="${glyphX}" y1="${midY - 4}" x2="${glyphX + 10}" y2="${midY + 4}" stroke="${style.border}" stroke-width="1.8" stroke-linecap="round" />`,
      `<line x1="${glyphX + 10}" y1="${midY - 4}" x2="${glyphX}" y2="${midY + 4}" stroke="${style.border}" stroke-width="1.8" stroke-linecap="round" />`
    );
  } else {
    out.push(
      `<circle cx="${glyphX + 5}" cy="${midY - 4}" r="1.2" fill="${style.border}" />`,
      `<line x1="${glyphX + 5}" y1="${midY - 1}" x2="${glyphX + 5}" y2="${midY + 4}" stroke="${style.border}" stroke-width="1.6" stroke-linecap="round" />`
    );
  }
  out.push(
    `<text x="${glyphX + 16}" y="${midY + theme.fontSize / 3}" font-size="${theme.smallFontSize}" font-weight="500" fill="${style.fg}">${escapeText(node.label)}</text>`
  );
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
function emitNavbar(laid, theme, out) {
  out.push(
    `<line x1="${laid.x}" y1="${laid.y + laid.height}" x2="${laid.x + laid.width}" y2="${laid.y + laid.height}" stroke="${theme.chromeLineColor}" stroke-width="${theme.chromeStrokeWidth}" />`
  );
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
  const accent = getAccent(node.attributes, theme);
  const titleColor = accent ?? theme.sectionTitleColor;
  out.push(
    `<text x="${laid.x}" y="${titleY}" font-size="${theme.sectionTitleFontSize}" font-weight="700" letter-spacing="0.8" fill="${titleColor}">${escapeText(node.title.toUpperCase())}</text>`
  );
  const badge = getAttrString2(node.attributes, "badge");
  if (badge !== void 0) {
    const badgeW = badgeRenderWidth(badge, theme);
    renderBadgePill(
      laid.x + laid.width - badgeW,
      laid.y + (theme.sectionTitleHeight - theme.badgeHeight) / 2,
      badge,
      theme,
      out,
      accent
    );
  }
  const lineY = laid.y + theme.sectionTitleHeight;
  out.push(
    `<line x1="${laid.x}" y1="${lineY}" x2="${laid.x + laid.width}" y2="${lineY}" stroke="${accent ?? theme.dividerColor}" stroke-width="${theme.dividerStrokeWidth}" opacity="${accent ? "0.8" : "0.6"}" />`
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
  const state = getState(node.attributes);
  const accent = getAccent(node.attributes, theme);
  let stroke;
  let strokeWidth;
  let fill;
  let textColor;
  let badgeIcon;
  if (state !== void 0) {
    const s = theme.states[state];
    stroke = accent ?? s.border;
    fill = s.fill;
    textColor = s.text;
    strokeWidth = state === "active" ? theme.slotActiveStrokeWidth : theme.slotStrokeWidth;
    badgeIcon = s.badge;
  } else if (isActive) {
    stroke = accent ?? theme.slotActiveBorderColor;
    fill = theme.slotFillColor;
    textColor = theme.textColor;
    strokeWidth = theme.slotActiveStrokeWidth;
  } else {
    stroke = accent ?? theme.slotBorderColor;
    fill = theme.slotFillColor;
    textColor = theme.textColor;
    strokeWidth = theme.slotStrokeWidth;
  }
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="4" />`
  );
  const titleX = laid.x + theme.slotPadding;
  const titleY = laid.y + theme.slotPadding + theme.slotTitleHeight * 0.7;
  out.push(
    `<text x="${titleX}" y="${titleY}" font-weight="600" fill="${textColor}">${escapeText(node.title)}</text>`
  );
  if (badgeIcon !== void 0) {
    const sz = 14;
    const bx = laid.x + laid.width - theme.slotPadding - sz;
    const by = laid.y + theme.slotPadding + (theme.slotTitleHeight - sz) / 2;
    const iconMarkup = emitIconByName(badgeIcon, bx, by, sz, stroke);
    if (iconMarkup) out.push(iconMarkup);
  }
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
  const accent = getAccent(node.attributes, theme);
  let fill = isPrimary ? theme.primaryButtonFill : theme.buttonFill;
  let textFill = isPrimary ? theme.primaryButtonText : theme.buttonText;
  let stroke = isDisabled ? theme.disabledColor : theme.buttonBorderColor;
  if (accent !== void 0 && !isDisabled) {
    if (isPrimary) {
      fill = accent;
      textFill = "#ffffff";
      stroke = accent;
    } else {
      stroke = accent;
      textFill = accent;
    }
  }
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
  const name = getAttrString2(node.attributes, "name") ?? "";
  const accent = getAccent(node.attributes, theme);
  const color = accent ?? theme.iconStrokeColor;
  if (name && hasIcon(name)) {
    const markup = emitIconByName(name, laid.x, laid.y, laid.width, color);
    if (markup !== void 0) {
      out.push(markup);
      return;
    }
  }
  const fallback = name || "?";
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="none" stroke="${color}" stroke-width="1" rx="3" />`
  );
  const glyph = fallback.charAt(0).toUpperCase();
  out.push(
    `<text x="${laid.x + laid.width / 2}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" text-anchor="middle" font-size="${theme.smallFontSize}" fill="${color}">${escapeText(glyph)}</text>`
  );
}
function emitDivider(laid, theme, out) {
  const y = laid.y + laid.height / 2;
  out.push(
    `<line x1="${laid.x}" y1="${y}" x2="${laid.x + laid.width}" y2="${y}" stroke="${theme.dividerColor}" stroke-width="${theme.dividerStrokeWidth}" />`
  );
}
function emitGrid(laid, theme, out) {
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitCell(laid, theme, out) {
  const node = laid.node;
  const state = getState(node.attributes);
  const accent = getAccent(node.attributes, theme);
  let stroke;
  let fill;
  let textColor;
  let badgeIcon;
  let strokeWidth = theme.slotStrokeWidth;
  if (state !== void 0) {
    const s = theme.states[state];
    stroke = accent ?? s.border;
    fill = s.fill;
    textColor = s.text;
    badgeIcon = s.badge;
    if (state === "active" || state === "purchased" || state === "ripe" || state === "maxed") {
      strokeWidth = theme.slotActiveStrokeWidth;
    }
  } else {
    stroke = accent ?? theme.slotBorderColor;
    fill = theme.slotFillColor;
    textColor = theme.textColor;
  }
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="3" />`
  );
  if (node.label !== void 0) {
    out.push(
      `<text x="${laid.x + theme.cellPadding}" y="${laid.y + theme.cellPadding + theme.fontSize}" font-weight="600" font-size="${theme.smallFontSize}" fill="${textColor}">${escapeText(node.label)}</text>`
    );
  }
  if (badgeIcon !== void 0) {
    const sz = 12;
    const bx = laid.x + laid.width - theme.cellPadding - sz;
    const by = laid.y + theme.cellPadding;
    const iconMarkup = emitIconByName(badgeIcon, bx, by, sz, stroke);
    if (iconMarkup) out.push(iconMarkup);
  }
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitResourceBar(laid, theme, out) {
  out.push(
    `<rect x="${laid.x - 4}" y="${laid.y - 4}" width="${laid.width + 8}" height="${laid.height + 8}" fill="${theme.slotFillColor}" stroke="${theme.panelBorderColor}" stroke-width="0.5" rx="3" opacity="0.6" />`
  );
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitResource(laid, theme, out) {
  const node = laid.node;
  const iconName = getAttrString2(node.attributes, "icon") ?? inferResourceIcon(node.name);
  const iconColor = theme.iconStrokeColor;
  if (iconName && hasIcon(iconName)) {
    const markup = emitIconByName(
      iconName,
      laid.x,
      laid.y + (laid.height - theme.resourceBarIconSize) / 2,
      theme.resourceBarIconSize,
      iconColor
    );
    if (markup) out.push(markup);
  } else {
    out.push(
      `<rect x="${laid.x + 0.5}" y="${laid.y + (laid.height - theme.resourceBarIconSize) / 2 + 0.5}" width="${theme.resourceBarIconSize - 1}" height="${theme.resourceBarIconSize - 1}" fill="none" stroke="${iconColor}" stroke-width="1" rx="2" />`
    );
  }
  const textX = laid.x + theme.resourceBarIconSize + 6;
  const textY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${textX}" y="${textY}" font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">${escapeText(node.name)}: </text><text x="${textX + (node.name.length + 2) * theme.averageCharWidth * (theme.smallFontSize / theme.fontSize)}" y="${textY}" font-size="${theme.smallFontSize}" font-weight="600" fill="${theme.textColor}">${escapeText(node.value)}</text>`
  );
}
function inferResourceIcon(name) {
  const lower = name.toLowerCase();
  if (hasIcon(lower)) return lower;
  if (/credit|coin|money|gold|cash/.test(lower)) return "credits";
  if (/research|science|lab/.test(lower)) return "research";
  if (/military|army|fleet|defense/.test(lower)) return "military";
  if (/industry|production|manufactur|factory/.test(lower)) return "industry";
  if (/influence|diplo/.test(lower)) return "influence";
  if (/approval|happy|morale/.test(lower)) return "approval";
  if (/faith|ideology|religion/.test(lower)) return "faith";
  if (/admin|authority|governance/.test(lower)) return "authority";
  if (/compute|computation|ai/.test(lower)) return "computation";
  if (/tech/.test(lower)) return "tech";
  if (/policy|law/.test(lower)) return "policy";
  return void 0;
}
function emitStats(laid, theme, out) {
  for (const c of laid.children) emitNode(c, theme, out);
}
function emitStat(laid, theme, out) {
  const node = laid.node;
  const isBold = hasFlag(node.attributes, "bold");
  const isMuted = hasFlag(node.attributes, "muted");
  const labelColor = isMuted ? theme.mutedTextColor : theme.mutedTextColor;
  const valueColor = isMuted ? theme.mutedTextColor : theme.textColor;
  const valueWeight = isBold ? "700" : "500";
  const baseline = laid.y + laid.height * 0.75;
  const labelW = node.label.length * theme.averageCharWidth * (theme.smallFontSize / theme.fontSize);
  out.push(
    `<text x="${laid.x}" y="${baseline}" font-size="${theme.smallFontSize}" letter-spacing="0.5" fill="${labelColor}">${escapeText(node.label.toUpperCase())}</text>`
  );
  out.push(
    `<text x="${laid.x + labelW + 6}" y="${baseline}" font-weight="${valueWeight}" fill="${valueColor}">${escapeText(node.value)}</text>`
  );
}
function emitProgress(laid, theme, out) {
  const node = laid.node;
  const label = getAttrString2(node.attributes, "label");
  const accent = getAccent(node.attributes, theme);
  const value = getAttrNumber2(node.attributes, "value") ?? 0;
  const max = Math.max(1, getAttrNumber2(node.attributes, "max") ?? 100);
  const frac = clamp01(value / max);
  const barY = label !== void 0 ? laid.y + theme.smallFontSize + 4 : laid.y;
  const barHeight = theme.progressHeight;
  if (label !== void 0) {
    out.push(
      `<text x="${laid.x}" y="${laid.y + theme.smallFontSize}" font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">${escapeText(label)}</text>`
    );
    const right = `${value} / ${max}`;
    out.push(
      `<text x="${laid.x + laid.width}" y="${laid.y + theme.smallFontSize}" text-anchor="end" font-size="${theme.smallFontSize}" font-weight="600" fill="${theme.textColor}">${escapeText(right)}</text>`
    );
  }
  out.push(
    `<rect x="${laid.x}" y="${barY}" width="${laid.width}" height="${barHeight}" fill="${theme.sliderTrackColor}" rx="${barHeight / 2}" />`
  );
  const fillColor = accent ?? theme.sliderFillColor;
  out.push(
    `<rect x="${laid.x}" y="${barY}" width="${laid.width * frac}" height="${barHeight}" fill="${fillColor}" rx="${barHeight / 2}" />`
  );
}
function emitChart(laid, theme, out) {
  const node = laid.node;
  const kindAttr = getAttrIdent2(node.attributes, "kind");
  const kind = kindAttr === "line" || kindAttr === "pie" ? kindAttr : "bar";
  const label = getAttrString2(node.attributes, "label");
  const accent = getAccent(node.attributes, theme);
  const stroke = accent ?? theme.panelBorderColor;
  const fill = theme.slotFillColor;
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${fill}" stroke="${stroke}" stroke-width="${theme.panelStrokeWidth}" stroke-dasharray="${theme.panelStrokeDasharray}" rx="3" />`
  );
  const inset = 12;
  const gx = laid.x + inset;
  const gy = laid.y + inset;
  const gw = laid.width - inset * 2;
  const gh = laid.height - inset * 2 - (label !== void 0 ? theme.smallFontSize + 4 : 0);
  const glyphStroke = accent ?? theme.mutedTextColor;
  if (kind === "bar") {
    const bars = 4;
    const barW = gw / (bars * 2);
    const heights = [0.4, 0.75, 0.55, 0.9];
    for (let i = 0; i < bars; i++) {
      const bh = gh * (heights[i] ?? 0.5);
      const bx = gx + i * barW * 2 + barW * 0.5;
      const by = gy + gh - bh;
      out.push(
        `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${glyphStroke}" opacity="0.75" />`
      );
    }
  } else if (kind === "line") {
    const points = [
      { x: 0, y: 0.7 },
      { x: 0.25, y: 0.45 },
      { x: 0.5, y: 0.55 },
      { x: 0.75, y: 0.2 },
      { x: 1, y: 0.3 }
    ];
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${gx + p.x * gw} ${gy + p.y * gh}`).join(" ");
    out.push(
      `<path d="${path}" fill="none" stroke="${glyphStroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />`
    );
    for (const p of points) {
      out.push(
        `<circle cx="${gx + p.x * gw}" cy="${gy + p.y * gh}" r="2" fill="${glyphStroke}" />`
      );
    }
  } else {
    const cx = gx + gw / 2;
    const cy = gy + gh / 2;
    const r = Math.min(gw, gh) / 2;
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${glyphStroke}" opacity="0.75" />`);
    const endX = cx + r * Math.cos(-Math.PI / 2 + 2 * Math.PI / 3);
    const endY = cy + r * Math.sin(-Math.PI / 2 + 2 * Math.PI / 3);
    out.push(
      `<path d="M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${endX} ${endY} Z" fill="${theme.background}" opacity="0.7" />`
    );
  }
  if (label !== void 0) {
    out.push(
      `<text x="${laid.x + laid.width / 2}" y="${laid.y + laid.height - 8}" text-anchor="middle" font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">${escapeText(label)}</text>`
    );
  }
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
function renderBadgePill(x, y, text, theme, out, accent) {
  const w = badgeRenderWidth(text, theme);
  const h = theme.badgeHeight;
  const fill = accent ?? theme.badgeFill;
  const textFill = accent ? "#ffffff" : theme.badgeText;
  out.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" />`,
    `<text x="${x + w / 2}" y="${y + h / 2 + theme.badgeFontSize / 3}" text-anchor="middle" font-size="${theme.badgeFontSize}" font-weight="600" fill="${textFill}">${escapeText(text)}</text>`
  );
}
function getAccent(attrs, theme) {
  const v = getAttrIdent2(attrs, "accent");
  if (v === void 0) return void 0;
  return theme.accents[v];
}
function getState(attrs) {
  const v = getAttrIdent2(attrs, "state");
  if (v === void 0) return void 0;
  return v;
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
  const laid = layout(doc, theme);
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
var wireloom = { initialize, parse: parse2, serialize: serialize2, render };
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