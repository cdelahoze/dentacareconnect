import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Middleware that inspects express-validator results and returns a structured 400 Bad Request
 * response if any validation rule fails.
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.type === 'field' ? err.path : err.type,
      message: err.msg,
      ...(err.type === 'field' && err.value !== undefined && { rejectedValue: err.value }),
    }));

    res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Validation failed. Please review the submitted payload or parameters.',
      errors: formattedErrors,
    });
    return;
  }

  next();
};
