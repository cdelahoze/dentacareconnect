import { Router } from 'express';
import {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
} from '../controllers/patient.controller';
import {
  createPatientValidator,
  updatePatientValidator,
  patientIdParamValidator,
  listPatientsQueryValidator,
} from '../validators/patient.validator';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

// POST /api/patients - Create a new patient
router.post('/', createPatientValidator, validateRequest, createPatient);

// GET /api/patients - List all patients (with search & pagination)
router.get('/', listPatientsQueryValidator, validateRequest, getAllPatients);

// GET /api/patients/:id - Get patient details by ID
router.get('/:id', patientIdParamValidator, validateRequest, getPatientById);

// PUT /api/patients/:id - Update patient profile
router.put('/:id', updatePatientValidator, validateRequest, updatePatient);

export default router;
