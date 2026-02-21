import logger from '../config/logger.js';

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const {method, originalUrl, ip} = req;
    const {statusCode} = res;
    const contentLength = res.get('content-length');

    const logLevel =
      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger.log(logLevel, `${method} ${originalUrl}`, {
      method,
      url: originalUrl,
      status: statusCode,
      duration: `${duration}ms`,
      ip,
      contentLength,
      userAgent: req.get('user-agent'),
    });
  });

  next();
};

export default requestLogger;
