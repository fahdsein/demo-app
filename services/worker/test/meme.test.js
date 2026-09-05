const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  buildMemeSvg,
  escapeXml,
  imageMimeType,
  resolveTemplatePath,
  wrapText
} = require('../meme');

test('escapes untrusted text for SVG output', () => {
  assert.equal(escapeXml('<b>"hello" & goodbye</b>'), '&lt;b&gt;&quot;hello&quot; &amp; goodbye&lt;/b&gt;');
});

test('wraps long text to a bounded number of lines', () => {
  const lines = wrapText('one two three four five six seven eight nine ten', 12, 3);
  assert.ok(lines.length <= 3);
  assert.ok(lines.every((line) => line.length <= 12));
});

test('resolves only known templates', () => {
  assert.equal(
    resolveTemplatePath('cat', 'fixtures'),
    path.join('fixtures', 'cat.webp')
  );
  assert.throws(() => resolveTemplatePath('unknown', 'fixtures'), /Unknown template/);
});

test('recognizes fixture MIME types', () => {
  assert.equal(imageMimeType('image.png'), 'image/png');
  assert.equal(imageMimeType('image.jpg'), 'image/jpeg');
  assert.equal(imageMimeType('image.webp'), 'image/webp');
});

test('builds an SVG buffer without raw markup from meme text', () => {
  const svg = buildMemeSvg({
    imageDataUri: 'data:image/png;base64,AA==',
    topText: '<script>alert(1)</script>',
    bottomText: 'safe'
  }).toString('utf8');
  assert.match(svg, /&lt;script&gt;/i);
  assert.doesNotMatch(svg, /<script>/);
});
