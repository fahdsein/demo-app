const path = require('node:path');

const TEMPLATE_FILES = Object.freeze({
  cat: 'cat.webp',
  pentol: 'pentol.jpg',
  psyduck: 'psyduck.png',
  saitama1: 'saitama1.jpg',
  saitama2: 'saitama2.jpg'
});

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapText(value, maximumCharacters = 24, maximumLines = 3) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maximumCharacters) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word.slice(0, maximumCharacters);
    if (lines.length === maximumLines - 1) break;
  }

  if (current && lines.length < maximumLines) lines.push(current);
  return lines;
}

function resolveTemplatePath(templateName, fixtureDirectory) {
  const filename = TEMPLATE_FILES[templateName];
  if (!filename) throw new Error('Unknown template');
  return path.join(fixtureDirectory, filename);
}

function imageMimeType(filename) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  throw new Error('Unsupported fixture image format');
}

function renderTextLines(lines, startingY) {
  return lines.map((line, index) => (
    `<text x="300" y="${startingY + (index * 48)}">${escapeXml(line.toUpperCase())}</text>`
  )).join('');
}

function buildMemeSvg({ imageDataUri, topText, bottomText }) {
  const topLines = wrapText(topText);
  const bottomLines = wrapText(bottomText);
  const bottomStart = 540 - ((bottomLines.length - 1) * 48);

  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <image href="${imageDataUri}" width="600" height="600" preserveAspectRatio="xMidYMid slice"/>
  <g fill="#fff" stroke="#000" stroke-width="7" paint-order="stroke fill" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700">
    ${renderTextLines(topLines, 60)}
    ${renderTextLines(bottomLines, bottomStart)}
  </g>
</svg>`, 'utf8');
}

module.exports = {
  TEMPLATE_FILES,
  buildMemeSvg,
  escapeXml,
  imageMimeType,
  resolveTemplatePath,
  wrapText
};
