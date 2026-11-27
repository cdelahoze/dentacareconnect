import { Request, Response, NextFunction } from 'express';
import { ProcedureService } from '../services/procedure.service';
import { ApiError } from '../utils/ApiError';
import { TreatmentStatus } from '@prisma/client';

/**
 * POST /api/procedures
 * Associate a new clinical dental procedure and mandatory follow-up timeline to a patient
 */
export const createProcedure = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { patientId, procedureName, followUpDays } = req.body;

    if (!patientId || !procedureName || followUpDays === undefined) {
      throw new ApiError(
        400,
        'patientId, procedureName, and followUpDays are required fields.'
      );
    }

    if (typeof patientId !== 'string' || !patientId.trim()) {
      throw new ApiError(400, 'patientId must be a valid UUID.');
    }

    const procedure = await ProcedureService.createProcedure({
      ...req.body,
      patientId: patientId.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Clinical procedure logged and follow-up timeline calculated successfully.',
      data: procedure,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/procedures
 * List all procedures (supports ?patientId=&status=&dueBefore=&page=&limit=)
 */
export const getAllProcedures = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientId = req.query.patientId
      ? (req.query.patientId as string)
      : undefined;
    const status = req.query.status as TreatmentStatus | undefined;
    const dueBefore = req.query.dueBefore as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    if (status && !Object.values(TreatmentStatus).includes(status)) {
      throw new ApiError(
        400,
        `Invalid status value. Allowed values: ${Object.values(TreatmentStatus).join(', ')}`
      );
    }

    const result = await ProcedureService.getAllProcedures({
      patientId,
      status,
      dueBefore,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/procedures/:id
 * Retrieve details of a specific clinical procedure
 */
export const getProcedureById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id.trim();
    if (!id) {
      throw new ApiError(400, 'Invalid procedure ID format.');
    }

    const procedure = await ProcedureService.getProcedureById(id);

    res.status(200).json({
      success: true,
      data: procedure,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/procedures/patient/:patientId
 * Retrieve all procedures and follow-up timelines for a specific patient
 */
export const getProceduresByPatient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientId = req.params.patientId.trim();
    if (!patientId) {
      throw new ApiError(400, 'Invalid patient ID format.');
    }

    const procedures = await ProcedureService.getProceduresByPatientId(patientId);

    res.status(200).json({
      success: true,
      count: procedures.length,
      data: procedures,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/procedures/:id
 * Update procedure details, status, or follow-up timeline
 */
export const updateProcedure = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id.trim();
    if (!id) {
      throw new ApiError(400, 'Invalid procedure ID format.');
    }

    if (req.body.status && !Object.values(TreatmentStatus).includes(req.body.status)) {
      throw new ApiError(
        400,
        `Invalid status value. Allowed values: ${Object.values(TreatmentStatus).join(', ')}`
      );
    }

    const updated = await ProcedureService.updateProcedure(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Clinical procedure updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
