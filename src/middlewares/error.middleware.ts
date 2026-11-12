import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

/**
 * Middleware to handle 404 Not Found errors for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new ApiError(404, `API Route ${req.method} ${req.originalUrl} not found.`);
  next(error);
};

/**
 * Global centralized error handling middleware
 */
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON payload format.';
  } else if (err.message) {
    message = err.message;
  }

  console.error(`[ERROR] ${req.method} ${req.originalUrl} >> Status: ${statusCode} | Message: ${message}`);

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
