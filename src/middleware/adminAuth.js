/**
 * Admin Authorization Middleware
 * Checks if the authenticated user has admin role
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      message: 'You do not have permission to access this resource',
    });
  }
  
  next();
};

/**
 * Check if user is admin or super admin
 */
const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }
  
  if (!['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Super admin access required',
      message: 'You do not have permission to access this resource',
    });
  }
  
  next();
};

module.exports = {
  isAdmin,
  isSuperAdmin,
};
