// src/utiles/logger.js
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info', // أقل مستوى يتم تسجيله (info, warn, error...)
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // التاريخ والوقت
    format.errors({ stack: true }), // يظهر stack trace لو في error
    format.splat(),
    format.json() // خليه JSON عشان يبقى منظم
  ),
  defaultMeta: { service: 'user-service' }, // ممكن تغير الاسم حسب المشروع
  transports: [
    // يطبع على الكونسول
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    // يسجل في ملف errors.log للأخطاء فقط
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    // يسجل في ملف combined.log لكل حاجة
    new transports.File({ filename: 'logs/combined.log' })
  ],
});

module.exports = logger;
