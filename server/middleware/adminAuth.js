const { ADMIN_PASSWORD } = require('../config');

function adminAuth(req, res, next) {
  const password = req.headers['x-admin-password'] || req.query.password;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password. Try again.' });
  }
  next();
}

module.exports = adminAuth;
