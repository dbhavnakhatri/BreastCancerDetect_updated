// This file is automatically loaded by react-scripts
// It configures the webpack-dev-server proxy

module.exports = function(app) {
  // Disable directory listing
  app.set('view engine', false);
  
  // Add security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
};
