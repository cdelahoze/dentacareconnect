import { body, param, query } from 'express-validator';
import { TreatmentStatus } from '@prisma/client';

const allowedStatuses = Object.values(TreatmentStatus);

export const createProcedureValidator = [
  body('patientId')
    .notEmpty()
    .withMessage('patientId is required.')
    .isUUID()
    .withMessage('patientId must be a valid UUID.'),

  body('procedureName')
    .trim()
    .notEmpty()
    .withMessage('procedureName is required.')
    .isLength({ min: 3, max: 120 })
    .withMessage('procedureName must be between 3 and 120 characters.'),

  body('procedureCode')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage('procedureCode cannot exceed 30 characters.'),

  body('dentistName')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('dentistName must be between 2 and 80 characters.'),

  body('procedureDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('procedureDate must be a valid ISO-8601 date string.'),

  body('followUpDays')
    .notEmpty()
    .withMessage('followUpDays is required.')
    .isInt({ min: 1, max: 365 })
    .withMessage('followUpDays must be an integer between 1 and 365 days.')
    .toInt(),

  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('notes cannot exceed 1000 characters.'),
];

export const updateProcedureValidator = [
  param('id')
    .isUUID()
    .withMessage('Procedure ID in URL must be a valid UUID.'),

  body('procedureName')
    .optional()
    .trim()
    .isLength({ min: 3, max: 120 })
    .withMessage('procedureName must be between 3 and 120 characters.'),

  body('procedureCode')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage('procedureCode cannot exceed 30 characters.'),

  body('dentistName')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('dentistName must be between 2 and 80 characters.'),

  body('procedureDate')
    .optional()
    .isISO8601()
    .withMessage('procedureDate must be a valid ISO-8601 date string.'),

  body('followUpDays')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('followUpDays must be an integer between 1 and 365 days.')
    .toInt(),

  body('nextControlDate')
    .optional()
    .isISO8601()
    .withMessage('nextControlDate must be a valid ISO-8601 date string.'),

  body('status')
    .optional()
    .isIn(allowedStatuses)
    .withMessage(`status must be one of: ${allowedStatuses.join(', ')}`),

  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('notes cannot exceed 1000 characters.'),
];

export const procedureIdParamValidator = [
  param('id')
    .isUUID()
    .withMessage('Procedure ID in URL must be a valid UUID.'),
];

export const proceduresByPatientParamValidator = [
  param('patientId')
    .isUUID()
    .withMessage('patientId in URL must be a valid UUID.'),
];

export const listProceduresQueryValidator = [
  query('patientId')
    .optional()
    .isUUID()
    .withMessage('patientId query parameter must be a valid UUID.'),

  query('status')
    .optional()
    .isIn(allowedStatuses)
    .withMessage(`status query parameter must be one of: ${allowedStatuses.join(', ')}`),

  query('dueBefore')
    .optional()
    .isISO8601()
    .withMessage('dueBefore query parameter must be a valid ISO-8601 date string.'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page query parameter must be a positive integer.'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit query parameter must be an integer between 1 and 100.'),
];
