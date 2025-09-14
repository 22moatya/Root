// src/controllers/errorController.js
const logger = require('../utiles/logger');

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // 📝 سجل الخطأ
  logger.error(`[${req.method}] ${req.originalUrl} - ${err.message}`, {
    stack: err.stack,
    statusCode: err.statusCode,
  });

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message
  });
};
