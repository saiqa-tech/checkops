export function sanitizeString(input) {
  if (input === null || input === undefined) {
    return '';
  }

  if (typeof input !== 'string') {
    input = String(input);
  }

  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

export function sanitizeHtml(input) {
  if (input === null || input === undefined) {
    return '';
  }

  if (typeof input !== 'string') {
    input = String(input);
  }

  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return input.replace(/[&<>"'/]/g, (char) => htmlEntities[char]);
}

export function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }

  return email.toLowerCase().trim();
}

export function sanitizeObject(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => {
      if (typeof item === 'string') {
        return sanitizeString(item);
      }
      if (typeof item === 'object') {
        return sanitizeObject(item);
      }
      return item;
    });
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key);
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value);
    } else if (typeof value === 'object') {
      sanitized[sanitizedKey] = sanitizeObject(value);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}

export function sanitizeJsonb(data) {
  try {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    return sanitizeObject(data);
  } catch (error) {
    throw new Error('Invalid JSONB data format');
  }
}
