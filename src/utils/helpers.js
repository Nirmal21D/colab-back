import crypto from 'crypto';

/**
 * Generate unique confirmation code
 */
export const generateConfirmationCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

/**
 * Generate unique slug from title
 */
export const generateSlug = (title) => {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  const randomSuffix = crypto.randomBytes(3).toString('hex');
  return `${baseSlug}-${randomSuffix}`;
};

/**
 * Async error wrapper for controllers
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Pagination helper
 */
export const getPagination = (page = 1, limit = 10) => {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  return {
    skip: (pageNum - 1) * limitNum,
    limit: limitNum,
    page: pageNum,
  };
};

/**
 * Send success response
 */
export const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send error response
 */
export const sendError = (res, message = 'Error', statusCode = 500, errors = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};
