/*
H25.4 (B376) -- COMMENTS READ AS A BROWSER READS THEM (tools/markup.mjs). The copied-lines measure removes comments before it compares
lines, so a reading that disagrees with the browser's either hides live lines (taking them for a comment) or keeps a comment (and a
comment put between a copy's lines breaks the run). H25.4's fifth verification hid copies through each case held below.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlSpans, htmlWithoutComments, cssWithoutComments } from '../tools/markup.mjs';

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
	assert.deepEqual(lines('.x { content: "/*"; }\n#kept { x: 1; }\n.y { content: "*/"; }'), ['.x { content: "/*"; }', '#kept { x: 1; }', '.y { content: "*/"; }'], 'a string');
	assert.deepEqual(lines('.x { content: "\\\n/*"; }\n#kept { x: 1; }\n.y { content: "*/"; }').filter((l) => l === '#kept { x: 1; }'), ['#kept { x: 1; }'], 'a string continued over an escaped newline');
	assert.deepEqual(lines('.x { content: "/*\n#kept { x: 1; }\n.y { content: "*/"; }').filter((l) => l === '#kept { x: 1; }'), ['#kept { x: 1; }'], 'a string broken by a newline ends there');
	assert.deepEqual(lines('#a { x: 1; }\f#b { x: 2; }\r#c { x: 3; }\r\n#d { x: 4; }'), ['#a { x: 1; }', '#b { x: 2; }', '#c { x: 3; }', '#d { x: 4; }'], 'form feed, CR and CRLF end lines');
	assert.deepEqual(lines('* { margin: 0; }'), ['* { margin: 0; }'], 'and a line opening with * is kept');
});
