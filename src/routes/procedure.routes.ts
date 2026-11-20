import { Router } from 'express';
import {
  createProcedure,
  getAllProcedures,
  getProcedureById,
  getProceduresByPatient,
  updateProcedure,
} from '../controllers/procedure.controller';
import {
  createProcedureValidator,
  updateProcedureValidator,
  procedureIdParamValidator,
  proceduresByPatientParamValidator,
  listProceduresQueryValidator,
} from '../validators/procedure.validator';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

// POST /api/procedures - Associate a new dental procedure & follow-up timeline to a patient
router.post('/', createProcedureValidator, validateRequest, createProcedure);

// GET /api/procedures/patient/:patientId - Retrieve all procedures for a specific patient (must be before /:id)
router.get(
  '/patient/:patientId',
  proceduresByPatientParamValidator,
  validateRequest,
  getProceduresByPatient
);

// GET /api/procedures/:id - Retrieve specific procedure details
router.get('/:id', procedureIdParamValidator, validateRequest, getProcedureById);

// PATCH /api/procedures/:id - Update procedure or status
router.patch('/:id', updateProcedureValidator, validateRequest, updateProcedure);

// GET /api/procedures - Retrieve all procedures with filters (must be last)
router.get('/', listProceduresQueryValidator, validateRequest, getAllProcedures);

export default router;
