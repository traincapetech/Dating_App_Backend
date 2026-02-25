import xss from 'xss';

/**
 * Input Sanitization Middleware
 * Protects against XSS attacks by sanitizing user inputs
 */

// Configure XSS options - strip all HTML tags
const xssOptions = {
  whiteList: {}, // No HTML tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: true,
};

/**
 * Recursively sanitize all string values in an object
 */
function sanitizeObject(obj) {
  if (typeof obj === 'string') {
    return xss(obj, xssOptions);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const key of Object.keys(obj)) {
      // Skip sanitizing certain fields that may contain safe HTML (like email templates)
      if (key === 'password' || key === 'confirmPassword') {
        // Don't sanitize passwords - they may contain special chars
        sanitized[key] = obj[key];
      } else {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Middleware to sanitize request body
 * Apply to routes that accept user input
 */
export const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Sanitize specific fields only (for targeted sanitization)
 * @param {string[]} fields - Array of field names to sanitize
 */
export const sanitizeFields = (fields) => {
  return (req, res, next) => {
    if (req.body) {
      for (const field of fields) {
        if (typeof req.body[field] === 'string') {
          req.body[field] = xss(req.body[field], xssOptions);
        }
      }
    }
    next();
  };
};

/**
 * Validate and sanitize bio text
 * - Max 500 characters
 * - Strip HTML
 */
export const sanitizeBio = (bio) => {
  if (!bio || typeof bio !== 'string') return '';
  const sanitized = xss(bio, xssOptions);
  return sanitized.slice(0, 500); // Limit to 500 chars
};

/**
 * Validate and sanitize prompt answers
 * - Max 300 characters per prompt
 * - Strip HTML
 */
export const sanitizePromptAnswer = (answer) => {
  if (!answer || typeof answer !== 'string') return '';
  const sanitized = xss(answer, xssOptions);
  return sanitized.slice(0, 300); // Limit to 300 chars
};

/**
 * Validate and sanitize chat message
 * - Max 2000 characters
 * - Strip HTML
 */
export const sanitizeMessage = (message) => {
  if (!message || typeof message !== 'string') return '';
  const sanitized = xss(message, xssOptions);
  return sanitized.slice(0, 2000); // Limit to 2000 chars
};

export default {
  sanitizeInput,
  sanitizeFields,
  sanitizeBio,
  sanitizePromptAnswer,
  sanitizeMessage,
};
