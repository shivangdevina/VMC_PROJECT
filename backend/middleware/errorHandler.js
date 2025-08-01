const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errors = err.details || err.message;
  } else if (err.name === 'UnauthorizedError' || err.message === 'Unauthorized') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError' || err.message === 'Forbidden') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError' || err.message === 'Not Found') {
    statusCode = 404;
    message = 'Not Found';
  } else if (err.name === 'ConflictError' || err.message === 'Conflict') {
    statusCode = 409;
    message = 'Conflict';
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    if (statusCode === 500) {
      message = 'Internal Server Error';
    }
  }

  const errorResponse = {
    success: false,
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString()
    }
  };

  // Add validation errors if present
  if (errors) {
    errorResponse.error.details = errors;
  }

  // Add request ID if present
  if (req.id) {
    errorResponse.error.requestId = req.id;
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = {
  errorHandler
};
