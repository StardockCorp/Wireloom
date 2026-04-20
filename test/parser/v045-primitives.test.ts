import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { serialize } from '../../src/parser/serializer.js';
import { WireloomError } from '../../src/parser/errors.js';
import type {
  AvatarNode,
  BreadcrumbNode,
  CheckboxNode,
  ChipNode,
  CrumbNode,
  MenubarNode,
  MenuItemNode,
  MenuNode,
  RadioNode,
  SpinnerNode,
  StatusNode,
  ToggleNode,
  TreeItemNode,
  TreeNode_,
} from '../../src/parser/ast.js';

function expectParseError(source: string): WireloomError {
  try {
    parse(source);
  } catch (err) {
    if (err instanceof WireloomError) return err;
    throw new Error(`expected WireloomError, got ${(err as Error).message}`);
  }
  throw new Error('expected parse error, got success');
}

function roundtripEquals(src: string): void {
  const ast1 = parse(src);
  const src2 = serialize(ast1);
  const src3 = serialize(parse(src2));
  expect(src3).toBe(src2);
}

describe('v0.4.5 — tree + node', () => {
  it('parses nested tree nodes', () => {
    const doc = parse(
      [
        'window:',
        '  tree:',
        '    node "src":',
        '      node "parser":',
        '        node "ast.ts"',
        '      node "renderer"',
        '    node "README.md"',
        '',
      ].join('\n'),
    );
    const tree = doc.root?.children[0] as TreeNode_;
    expect(tree.kind).toBe('tree');
    expect(tree.children.length).toBe(2);
    const src = tree.children[0] as TreeItemNode;
    expect(src.label).toBe('src');
    expect(src.children.length).toBe(2);
    expect((src.children[0] as TreeItemNode).children[0]?.label).toBe('ast.ts');
  });

  it('accepts collapsed and selected flags plus icon attribute', () => {
    const doc = parse(
      [
        'window:',
        '  tree:',
        '    node "Folder" collapsed icon="policy":',
        '      node "child"',
        '    node "Selected" selected',
        '',
      ].join('\n'),
    );
    const tree = doc.root?.children[0] as TreeNode_;
    const folder = tree.children[0] as TreeItemNode;
    expect(folder.attributes.some((a) => a.kind === 'flag' && a.flag === 'collapsed')).toBe(true);
  });

  it('rejects node outside of tree', () => {
    const err = expectParseError('window:\n  node "stray"\n');
    expect(err.message).toMatch(/node.*only appear inside.*tree/);
  });

  it('rejects non-node child of tree', () => {
    const err = expectParseError('window:\n  tree:\n    text "nope"\n');
    expect(err.message).toMatch(/tree.*only.*node/);
  });

  it('roundtrips cleanly', () => {
    roundtripEquals(
      [
        'window:',
        '  tree:',
        '    node "a" collapsed:',
        '      node "b"',
        '    node "c" selected icon="gear"',
        '',
      ].join('\n'),
    );
  });
});

describe('v0.4.5 — checkbox / radio / toggle', () => {
  it('parses checkbox with checked flag', () => {
    const doc = parse('window:\n  checkbox "Enable notifications" checked\n');
    const cb = doc.root?.children[0] as CheckboxNode;
    expect(cb.kind).toBe('checkbox');
    expect(cb.label).toBe('Enable notifications');
  });

  it('parses radio with group attribute', () => {
    const doc = parse(
      [
        'window:',
        '  radio "Light" group="theme" selected',
        '  radio "Dark" group="theme"',
        '',
      ].join('\n'),
    );
    const r = doc.root?.children[0] as RadioNode;
    expect(r.kind).toBe('radio');
    expect(r.attributes.some((a) => a.kind === 'pair' && a.key === 'group')).toBe(true);
  });

  it('parses toggle with on and label-right flags', () => {
    const doc = parse('window:\n  toggle "Dark mode" on label-right\n');
    const t = doc.root?.children[0] as ToggleNode;
    expect(t.kind).toBe('toggle');
  });

  it('rejects checkbox without label', () => {
    const err = expectParseError('window:\n  checkbox\n');
    expect(err.message).toMatch(/checkbox.*label/);
  });

  it('roundtrips a settings row mix', () => {
    roundtripEquals(
      [
        'window:',
        '  checkbox "A" checked',
        '  radio "B" group="g" selected',
        '  toggle "C" on',
        '',
      ].join('\n'),
    );
  });
});

describe('v0.4.5 — menubar / menu / menuitem / separator', () => {
  it('parses a menubar with menus and items', () => {
    const doc = parse(
      [
        'window:',
        '  menubar:',
        '    menu "File":',
        '      menuitem "New" shortcut="Ctrl+N"',
        '      menuitem "Open…" shortcut="Ctrl+O"',
        '      separator',
        '      menuitem "Quit" disabled',
        '    menu "Edit":',
        '      menuitem "Cut"',
        '',
      ].join('\n'),
    );
    const mb = doc.root?.children[0] as MenubarNode;
    expect(mb.kind).toBe('menubar');
    expect(mb.children.length).toBe(2);
    const file = mb.children[0] as MenuNode;
    expect(file.label).toBe('File');
    expect(file.children.length).toBe(4);
    const mi = file.children[0] as MenuItemNode;
    expect(mi.label).toBe('New');
  });

  it('accepts nested submenu inside menu', () => {
    const doc = parse(
      [
        'window:',
        '  menu "File":',
        '    menu "Recent":',
        '      menuitem "project.md"',
        '',
      ].join('\n'),
    );
    const m = doc.root?.children[0] as MenuNode;
    expect(m.children[0]?.kind).toBe('menu');
  });

  it('rejects menuitem outside menu', () => {
    const err = expectParseError('window:\n  menuitem "stray"\n');
    expect(err.message).toMatch(/menuitem.*only appear inside.*menu/);
  });

  it('rejects separator outside menu', () => {
    const err = expectParseError('window:\n  separator\n');
    expect(err.message).toMatch(/separator.*only appear inside.*menu/);
  });

  it('rejects item inside menu (do not reuse item token)', () => {
    const err = expectParseError(
      'window:\n  menu "File":\n    item "nope"\n',
    );
    expect(err.message).toMatch(/menuitem|menu.*accepts only/);
  });

  it('roundtrips menubar with nested submenu and separator', () => {
    roundtripEquals(
      [
        'window:',
        '  menubar:',
        '    menu "File":',
        '      menuitem "New" shortcut="Ctrl+N"',
        '      separator',
        '      menu "Recent":',
        '        menuitem "a.md"',
        '',
      ].join('\n'),
    );
  });
});

describe('v0.4.5 — chip', () => {
  it('parses chip with attrs and flags', () => {
    const doc = parse(
      'window:\n  chip "Priority" closable selected accent=wealth icon="credits"\n',
    );
    const c = doc.root?.children[0] as ChipNode;
    expect(c.kind).toBe('chip');
    expect(c.label).toBe('Priority');
  });

  it('roundtrips', () => {
    roundtripEquals('window:\n  chip "Filter" closable accent=warning\n');
  });
});

describe('v0.4.5 — avatar', () => {
  it('parses avatar with initials and size', () => {
    const doc = parse('window:\n  avatar "BW" size=large accent=research\n');
    const a = doc.root?.children[0] as AvatarNode;
    expect(a.kind).toBe('avatar');
    expect(a.initials).toBe('BW');
  });

  it('rejects unknown size enum', () => {
    const err = expectParseError('window:\n  avatar "X" size=tiny\n');
    expect(err.message).toMatch(/not a valid size/);
  });
});

describe('v0.4.5 — breadcrumb + crumb', () => {
  it('parses breadcrumb with crumbs', () => {
    const doc = parse(
      [
        'window:',
        '  breadcrumb:',
        '    crumb "This PC" icon="gear"',
        '    crumb "Docs"',
        '    crumb "Project"',
        '',
      ].join('\n'),
    );
    const bc = doc.root?.children[0] as BreadcrumbNode;
    expect(bc.kind).toBe('breadcrumb');
    expect(bc.children.length).toBe(3);
    expect((bc.children[0] as CrumbNode).label).toBe('This PC');
  });

  it('rejects crumb outside breadcrumb', () => {
    const err = expectParseError('window:\n  crumb "stray"\n');
    expect(err.message).toMatch(/crumb.*only appear inside.*breadcrumb/);
  });

  it('roundtrips', () => {
    roundtripEquals(
      [
        'window:',
        '  breadcrumb:',
        '    crumb "a"',
        '    crumb "b" icon="gear"',
        '',
      ].join('\n'),
    );
  });
});

describe('v0.4.5 — spinner / status', () => {
  it('parses spinner with optional label', () => {
    const doc = parse('window:\n  spinner "Loading…"\n');
    const s = doc.root?.children[0] as SpinnerNode;
    expect(s.kind).toBe('spinner');
    expect(s.label).toBe('Loading…');
  });

  it('parses spinner without label', () => {
    const doc = parse('window:\n  spinner\n');
    const s = doc.root?.children[0] as SpinnerNode;
    expect(s.label).toBeUndefined();
  });

  it('parses status with kind', () => {
    const doc = parse('window:\n  status "Saved" kind=success\n');
    const s = doc.root?.children[0] as StatusNode;
    expect(s.kind).toBe('status');
    expect(s.label).toBe('Saved');
  });

  it('rejects status without kind=', () => {
    const err = expectParseError('window:\n  status "Saved"\n');
    expect(err.message).toMatch(/status.*kind=/);
  });

  it('rejects unknown status kind', () => {
    const err = expectParseError('window:\n  status "X" kind=weird\n');
    expect(err.message).toMatch(/not a valid kind/);
  });

  it('roundtrips a status strip', () => {
    roundtripEquals(
      [
        'window:',
        '  status "Saved" kind=success',
        '  status "Heads up" kind=warning',
        '  spinner "Syncing…"',
        '',
      ].join('\n'),
    );
  });
});
