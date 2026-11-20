import { body, param, query } from 'express-validator';

export const createPatientValidator = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('firstName is required.')
    .isLength({ min: 2, max: 60 })
    .withMessage('firstName must be between 2 and 60 characters.'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('lastName is required.')
    .isLength({ min: 2, max: 60 })
    .withMessage('lastName must be between 2 and 60 characters.'),

  body('documentId')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 4, max: 30 })
    .withMessage('documentId must be between 4 and 30 characters.'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('email is required.')
    .isEmail()
    .withMessage('Must provide a valid email address.')
    .normalizeEmail(),

body('phone')
    .trim()
    .notEmpty()
    .withMessage('phone is required.')
    .bail() // Detiene la validación de este campo si está vacío
    .matches(/^\+?[0-9\s\-()]{7,20}$/)
    .withMessage('phone must be a valid phone number (7 to 20 digits, optional + prefix).'),

  body('whatsappNumber')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(/^\+?[0-9\s\-()]{7,20}$/)
    .withMessage('whatsappNumber must be a valid phone number.'),

  body('birthDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('birthDate must be a valid ISO-8601 date (YYYY-MM-DD).')
    .toDate(),

  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('notes cannot exceed 1000 characters.'),
];

export const updatePatientValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Patient ID in URL must be a positive integer.'),

  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('firstName must be between 2 and 60 characters.'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('lastName must be between 2 and 60 characters.'),

  body('documentId')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 4, max: 30 })
    .withMessage('documentId must be between 4 and 30 characters.'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Must provide a valid email address.')
    .normalizeEmail(),

  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[0-9\s\-()]{7,20}$/)
    .withMessage('phone must be a valid phone number.'),

  body('whatsappNumber')
    .optional({ nullable: true })
    .trim()
    .matches(/^\+?[0-9\s\-()]{7,20}$/)
    .withMessage('whatsappNumber must be a valid phone number.'),

  body('birthDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('birthDate must be a valid ISO-8601 date (YYYY-MM-DD).'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean (true or false).'),

  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('notes cannot exceed 1000 characters.'),
];

export const patientIdParamValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Patient ID in URL must be a positive integer.'),
];

export const listPatientsQueryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page query parameter must be a positive integer.'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit query parameter must be an integer between 1 and 100.'),
];
