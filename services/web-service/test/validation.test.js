const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ValidationError,
  validateGeneratePayload
} = require('../validation');

test('normalizes a valid generation payload', () => {
  assert.deepEqual(validateGeneratePayload({
    templateName: ' CAT ',
    topText: ' hello ',
    bottomText: ' world '
  }), {
    templateName: 'cat',
    topText: 'hello',
    bottomText: 'world'
  });
});

test('rejects an unknown template', () => {
  assert.throws(
    () => validateGeneratePayload({ templateName: 'unknown' }),
    ValidationError
  );
});

test('rejects oversized text', () => {
  assert.throws(
    () => validateGeneratePayload({
      templateName: 'cat',
      topText: 'x'.repeat(501)
    }),
    /500 characters or fewer/
  );
});
