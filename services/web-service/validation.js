const ALLOWED_TEMPLATES = new Set([
  'cat',
  'pentol',
  'psyduck',
  'saitama1',
  'saitama2'
]);

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function normalizeText(value, fieldName, maxLength, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new ValidationError(`${fieldName} is required.`);
    return '';
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be text.`);
  }

  const normalized = value.trim();
  if (required && normalized.length === 0) {
    throw new ValidationError(`${fieldName} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new ValidationError(`${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function validateGeneratePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('A JSON object is required.');
  }

  const templateName = normalizeText(body.templateName, 'Template name', 100, {
    required: true
  }).toLowerCase();

  if (!ALLOWED_TEMPLATES.has(templateName)) {
    throw new ValidationError('Select one of the available templates.');
  }

  return {
    templateName,
    topText: normalizeText(body.topText, 'Top text', 500),
    bottomText: normalizeText(body.bottomText, 'Bottom text', 500)
  };
}

module.exports = {
  ALLOWED_TEMPLATES,
  ValidationError,
  normalizeText,
  validateGeneratePayload
};
