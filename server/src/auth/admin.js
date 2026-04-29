const { adminPassword } = require('../config');

// Tiny bearer-style auth: client sends `x-admin-password: <password>`.
// Single shared password since only the host uses /admin.
function requireAdmin(req, res, next) {
  const provided = req.get('x-admin-password');
  if (!provided || provided !== adminPassword) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

module.exports = { requireAdmin };
