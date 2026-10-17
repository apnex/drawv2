/*
H25.4 (B376) -- COMMENTS READ AS A BROWSER READS THEM (tools/markup.mjs). The copied-lines measure removes comments before it compares
lines, so a reading that disagrees with the browser's either hides live lines (taking them for a comment) or keeps a comment (and a
comment put between a copy's lines breaks the run). H25.4's fifth verification hid copies through each case held below.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlSpans, htmlWithoutComments, cssWithoutComments, markupFaults } from '../tools/markup.mjs';

const live = (html) => htmlWithoutComments(html).split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);

test('H25.4: a page\'s comment ends where a browser ends it -- at -->, at --!>, or at once as <!--> and <!--->', () => {
	assert.deepEqual(live('<!-- a -->\n<p>kept</p>'), ['<p>kept</p>'], 'control: a comment removed');
	assert.deepEqual(live('<!-->\n<p>kept</p>\n<!-- x -->'), ['<p>kept</p>'], '<!--> is a whole comment');
	assert.deepEqual(live('<!--->\n<p>kept</p>\n<!-- x -->'), ['<p>kept</p>'], 'and <!--->');
	assert.deepEqual(live('<!-- a --!>\n<p>kept</p>\n<!-- x -->'), ['<p>kept</p>'], 'and one closed by --!>');
	assert.deepEqual(live('<p>kept</p>\n<!-- left open\n<p>gone</p>'), ['<p>kept</p>'], 'one left open runs to the end');
});

test('H25.4: nothing inside a tag, raw text or an SVG CDATA section opens a comment, and a stray < opens nothing', () => {
	assert.deepEqual(live('<p title="<!--">a</p>\n<p>kept</p>\n<p title="-->">b</p>'), ['<p title="<!--">a</p>', '<p>kept</p>', '<p title="-->">b</p>'], 'a quoted attribute');
	assert.deepEqual(live('<p x=a\'b>a</p>\n<!-- c -->\n<p>kept</p>'), ['<p x=a\'b>a</p>', '<p>kept</p>'], 'an unquoted value holding a quote opens no quoted value, so the comment after it is read');
	assert.deepEqual(live('<div data-x=a="b data-y="><!--">\n<p>kept</p>\n<div data-z="-->"></div>'), ['<div data-x=a="b data-y="><!--">', '<p>kept</p>', '<div data-z="-->"></div>'], 'an = inside an unquoted value opens no new value');
	assert.deepEqual(live('<div data-x=a=\'b>\n<!-- c -->\n<p>kept</p>'), ['<div data-x=a=\'b>', '<p>kept</p>'], 'nor a quote after an = inside an unquoted value');
	assert.deepEqual(live('<svg data-x=a/><![CDATA[ > <!-- ]]></svg>\n<p>kept</p>\n<!-- end -->'), ['<svg data-x=a/><![CDATA[ > <!-- ]]></svg>', '<p>kept</p>'], 'a / ending an unquoted value does not self-close <svg>');
	assert.deepEqual(live('<p>a</p>\n</>\n<p>b</p>'), ['<p>a</p>', '<p>b</p>'], 'an empty </> close tag is removed like a bogus comment');
	assert.deepEqual(live('<script><!--<script></script><!--</script>\n<p>kept</p>\n<!-- end -->'), ['<script><!--<script></script><!--</script>', '<p>kept</p>'], 'a double-escaped <script> runs to its matching close');
	assert.deepEqual(live('<script><!--><script></script>\n<!-- c -->\n<p>kept</p>'), ['<script><!--><script></script>', '<p>kept</p>'], '<!--> inside <script> closes its escaped state at once');
	assert.deepEqual(live('<script><!---><script></script>\n<!-- c -->\n<p>kept</p>'), ['<script><!---><script></script>', '<p>kept</p>'], 'and <!---> inside <script>');
	assert.deepEqual(live('<svg><foreignObject><textarea><!--</textarea></foreignObject></svg>\n<p>kept</p>\n<!-- end -->'), ['<svg><foreignObject><textarea><!--</textarea></foreignObject></svg>', '<p>kept</p>'], 'an SVG HTML integration point parses <textarea> as raw text');
	assert.deepEqual(live('<math><mi><textarea><!--</textarea></mi></math>\n<p>kept</p>\n<!-- end -->'), ['<math><mi><textarea><!--</textarea></mi></math>', '<p>kept</p>'], 'and a MathML integration point');
	assert.deepEqual(live('<svg><div></div><![CDATA[ > <!-- ]]></svg>\n<p>swallowed</p>\n<!-- end -->\n<p>kept</p>'), ['<svg><div></div>', '<p>kept</p>'], 'an HTML breakout tag inside <svg> exits foreign content');
	assert.deepEqual(live('<textarea><!--</textarea>\n<p>kept</p>\n<p>--></p>'), ['<textarea><!--</textarea>', '<p>kept</p>', '<p>--></p>'], 'raw text');
	assert.deepEqual(live('<style><!--</style>\n<p>kept</p>\n<p>--></p>'), ['<style><!--</style>', '<p>kept</p>', '<p>--></p>'], 'a style element');
	assert.deepEqual(live('<svg><![CDATA[ > <!-- ]]></svg>\n<p>kept</p>\n<p>--></p>'), ['<svg><![CDATA[ > <!-- ]]></svg>', '<p>kept</p>', '<p>--></p>'], 'an SVG CDATA section');
	assert.deepEqual(live('<p>1 < 2 "</p>\n<!-- c -->\n<p>kept</p>'), ['<p>1 < 2 "</p>', '<p>kept</p>'], 'a stray < opens no tag, so the comment after it is read');
	assert.deepEqual(live('<?x a?>\n<!x>\n<p>kept</p>'), ['<p>kept</p>'], 'bogus comments are comments');
	assert.deepEqual(live('<!DOCTYPE html>\n<p>kept</p>'), ['<!DOCTYPE html>', '<p>kept</p>'], 'control: a doctype is no comment');
});

test('H25.4: a style element\'s text loses its stylesheet comments, as a stylesheet does', () => {
	assert.deepEqual(live('<style>\n#a { color: red; }\n/* note */\n#b { color: blue; }\n</style>'), ['<style>', '#a { color: red; }', '#b { color: blue; }', '</style>']);
	assert.deepEqual(htmlSpans('<style>x</style><svg><style>y</style></svg>').styles.length, 1, 'control: in SVG a style element is no raw text');
});

test('H25.4: a stylesheet\'s comment is read outside its strings and unquoted url(); every CSS line end counts', () => {
	const lines = (css) => cssWithoutComments(css).split('\n').map((l) => l.trim()).filter(Boolean);
	assert.deepEqual(lines('#a { x: 1; }\n/* gone */\n#b { x: 2; }'), ['#a { x: 1; }', '#b { x: 2; }'], 'control: a comment removed');
	assert.deepEqual(lines('.x { background: url(/*); }\n#kept { x: 1; }\n.y { background: url(*/); }'), ['.x { background: url(/*); }', '#kept { x: 1; }', '.y { background: url(*/); }'], 'unquoted url()');
	assert.deepEqual(lines(`.x { background: url(${' '.repeat(80)}/*); }\n#kept { x: 1; }\n.y { background: url(*/); }`).filter((l) => l === '#kept { x: 1; }'), ['#kept { x: 1; }'], 'unquoted url() after any run of whitespace');
	assert.deepEqual(lines('#a { content: a\\:url(/* gone */); }\n#b { x: 1; }'), ['#a { content: a\\:url(); }', '#b { x: 1; }'], 'an escaped colon before url() is one identifier, not url()');
	assert.deepEqual(lines('#x { --q: \\"; content: "/*"; }\n#kept { x: 1; }\n#y { --q: \\"; content: "*/"; }').filter((l) => l === '#kept { x: 1; }'), ['#kept { x: 1; }'], 'an escaped quote outside a string opens no string');
	assert.deepEqual(lines('#x { --s: \\/*; }\n#kept { x: 1; }\n#y { --s: */; }').filter((l) => l === '#kept { x: 1; }'), ['#kept { x: 1; }'], 'an escaped slash before * opens no comment');
	assert.deepEqual(lines('#x { background: url(a(/*); }\n#kept { x: 1; }\n#y { background: url(*/); }').filter((l) => l === '#kept { x: 1; }'), ['#kept { x: 1; }'], 'bad-url remnants with ( or quotes still consume to )');
	assert.deepEqual(lines('#x { background: u\\rl(/*); }\n#kept { x: 1; }\n#y { background: \\75 rl(*/); }').filter((l) => l === '#kept { x: 1; }'), ['#kept { x: 1; }'], 'escaped u\\rl( and \\75 rl( are url() tokens');
	assert.deepEqual(lines('#x { content: a\\3a url(/* gone */); }'), ['#x { content: a\\3a url(); }'], 'a hex escape + space inside an identifier keeps a\\3a url( one identifier, so its comment is removed');
	assert.deepEqual(lines('.x { content: "/*"; }\n#kept { x: 1; }\n.y { content: "*/"; }'), ['.x { content: "/*"; }', '#kept { x: 1; }', '.y { content: "*/"; }'], 'a string');
	assert.deepEqual(lines('.x { content: "\\\n/*"; }\n#kept { x: 1; }\n.y { content: "*/"; }').filter((l) => l === '#kept { x: 1; }'), ['#kept { x: 1; }'], 'a string continued over an escaped newline');
	assert.deepEqual(lines('.x { content: "/*\n#kept { x: 1; }\n.y { content: "*/"; }').filter((l) => l === '#kept { x: 1; }'), ['#kept { x: 1; }'], 'a string broken by a newline ends there');
	assert.deepEqual(lines('#a { x: 1; }\f#b { x: 2; }\r#c { x: 3; }\r\n#d { x: 4; }'), ['#a { x: 1; }', '#b { x: 2; }', '#c { x: 3; }', '#d { x: 4; }'], 'form feed, CR and CRLF end lines');
	assert.deepEqual(lines('* { margin: 0; }'), ['* { margin: 0; }'], 'and a line opening with * is kept');
});

test('H25.4: markupFaults accepts the product\'s clean pages and stylesheets and refuses malformed or adversarial constructs', () => {
	assert.deepEqual(markupFaults({ name: 'a.html', text: '<!DOCTYPE html>\n<html><head><link rel="stylesheet" href="/a.css"></head><body><!-- clean --><svg id="c"><g id="z"></g></svg></body></html>' }), [], 'clean page');
	assert.deepEqual(markupFaults({ name: 'a.css', text: '/* clean */\n.zone { fill: var(--tok-panel); }' }), [], 'clean stylesheet');
	assert.ok(markupFaults({ name: 'a.html', text: '<!-->\n<p>x</p>' }).length > 0, 'degenerate comment refused');
	assert.equal(markupFaults({ name: 'a.html', text: '<div x=a></div>' }).length, 1, 'unquoted attribute refused');
	assert.equal(markupFaults({ name: 'a.html', text: '<textarea>x</textarea>' }).length, 1, 'inline raw-text element refused');
	assert.equal(markupFaults({ name: 'a.css', text: '.a { background: url(x); }' }).length, 1, 'CSS url() or escape refused');
});
