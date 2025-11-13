export function errorHandler(err, req, res, _next) {
  if (err.name === 'ZodError') {
    const details = err.errors?.map(item => ({
      path: item.path.join('.'),
      message: item.message,
    }));
    return res.status(400).json({
      message: 'Validation failed',
      errors: details,
    });
  }

  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  const payload = {
    message,
  };
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}

export default errorHandler;

