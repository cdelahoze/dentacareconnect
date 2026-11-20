import { Request, Response, NextFunction } from 'express';
import { PatientService } from '../services/patient.service';
import { ApiError } from '../utils/ApiError';

/**
 * POST /api/patients
 * Create a new patient profile
 */
export const createPatient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { firstName, lastName, email, phone } = req.body;

    if (!firstName || !lastName || !email || !phone) {
      throw new ApiError(400, 'firstName, lastName, email, and phone are required fields.');
    }

    const patient = await PatientService.createPatient(req.body);

    res.status(201).json({
      success: true,
      message: 'Patient profile created successfully.',
      data: patient,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/patients
 * Retrieve all patients (supports ?search=&page=&limit=)
 */
export const getAllPatients = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    const result = await PatientService.getAllPatients(search, page, limit);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/patients/:id
 * Retrieve a single patient profile by ID
 */
export const getPatientById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id?.trim();
    if (!id) {
      throw new ApiError(400, 'Invalid patient ID.');
    }

    const patient = await PatientService.getPatientById(id);

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/patients/:id
 * Update an existing patient profile
 */
export const updatePatient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id?.trim();
    if (!id) {
      throw new ApiError(400, 'Invalid patient ID.');
    }

    const updatedPatient = await PatientService.updatePatient(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Patient profile updated successfully.',
      data: updatedPatient,
    });
  } catch (error) {
    next(error);
  }
};
