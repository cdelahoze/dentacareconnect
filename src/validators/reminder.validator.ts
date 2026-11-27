import { body, query } from 'express-validator';

export const dispatchReminderValidator = [
  body('procedureId')
    .trim()
    .notEmpty()
    .withMessage('procedureId is required.')
    .bail()
    .isUUID()
    .withMessage('procedureId must be a valid UUID.'),

  body('customMessage')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 5, max: 1600 })
    .withMessage('customMessage must be between 5 and 1600 characters.'),
];

export const listRemindersQueryValidator = [
  query('procedureId')
    .optional()
    .isUUID()
    .withMessage('procedureId query parameter must be a valid UUID.'),

  query('patientId')
    .optional()
    .isUUID()
    .withMessage('patientId query parameter must be a valid UUID.'),
];
