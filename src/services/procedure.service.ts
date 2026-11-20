import prisma from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { Prisma, ProcedureStatus } from '@prisma/client';

export interface CreateProcedureInput {
  patientId: number;
  procedureName: string;
  procedureCode?: string;
  dentistName?: string;
  procedureDate?: string;
  followUpDays: number;
  notes?: string;
}

export interface UpdateProcedureInput {
  procedureName?: string;
  procedureCode?: string;
  dentistName?: string;
  procedureDate?: string;
  followUpDays?: number;
  nextControlDate?: string;
  status?: ProcedureStatus;
  notes?: string;
}

export class ProcedureService {
  /**
   * Helper to calculate target follow-up control date from procedure date + followUpDays
   */
  private static calculateNextControlDate(baseDate: Date, followUpDays: number): Date {
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + followUpDays);
    return targetDate;
  }

  /**
   * Log a new dental procedure for a patient and automatically calculate mandatory follow-up date
   */
  static async createProcedure(data: CreateProcedureInput) {
    // Verify patient exists and is active
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
    });

    if (!patient) {
      throw new ApiError(404, `Patient with ID ${data.patientId} not found.`);
    }

    if (!patient.isActive) {
      throw new ApiError(400, `Cannot log procedure for inactive patient (ID ${data.patientId}).`);
    }

    const procDate = data.procedureDate ? new Date(data.procedureDate) : new Date();
    if (isNaN(procDate.getTime())) {
      throw new ApiError(400, 'Invalid procedureDate format. Use ISO-8601 date string.');
    }

    const followUpDays = Number(data.followUpDays);
    if (!Number.isInteger(followUpDays) || followUpDays < 1) {
      throw new ApiError(400, 'followUpDays must be a positive integer (e.g., 7, 15, 30).');
    }

    const nextControlDate = this.calculateNextControlDate(procDate, followUpDays);

    return await prisma.procedure.create({
      data: {
        patientId: data.patientId,
        procedureName: data.procedureName.trim(),
        procedureCode: data.procedureCode?.trim() || null,
        dentistName: data.dentistName?.trim() || null,
        procedureDate: procDate,
        followUpDays,
        nextControlDate,
        status: ProcedureStatus.PENDING,
        notes: data.notes?.trim() || null,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  /**
   * Retrieve all logged procedures with optional filters (patientId, status, dueBefore)
   */
  static async getAllProcedures(filters?: {
    patientId?: number;
    status?: ProcedureStatus;
    dueBefore?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProcedureWhereInput = {
      ...(filters?.patientId && { patientId: filters.patientId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.dueBefore && {
        nextControlDate: {
          lte: new Date(filters.dueBefore),
        },
      }),
    };

    const [procedures, total] = await Promise.all([
      prisma.procedure.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nextControlDate: 'asc' },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              whatsappNumber: true,
            },
          },
          appointments: {
            orderBy: { scheduledDate: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.procedure.count({ where }),
    ]);

    return {
      data: procedures,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieve a specific procedure by ID with patient and history details
   */
  static async getProcedureById(id: number) {
    const procedure = await prisma.procedure.findUnique({
      where: { id },
      include: {
        patient: true,
        appointments: {
          orderBy: { scheduledDate: 'desc' },
        },
        reminders: {
          orderBy: { createdAt: 'desc' },
        },
        outreachLogs: {
          orderBy: { contactedAt: 'desc' },
        },
      },
    });

    if (!procedure) {
      throw new ApiError(404, `Procedure with ID ${id} not found.`);
    }

    return procedure;
  }

  /**
   * Retrieve all procedures associated with a specific patient
   */
  static async getProceduresByPatientId(patientId: number) {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new ApiError(404, `Patient with ID ${patientId} not found.`);
    }

    return await prisma.procedure.findMany({
      where: { patientId },
      orderBy: { nextControlDate: 'asc' },
      include: {
        appointments: true,
        reminders: true,
      },
    });
  }

  /**
   * Update procedure details, status, or recalculate follow-up timeline
   */
  static async updateProcedure(id: number, data: UpdateProcedureInput) {
    const existing = await this.getProcedureById(id);

    const updatedProcDate = data.procedureDate
      ? new Date(data.procedureDate)
      : existing.procedureDate;

    if (isNaN(updatedProcDate.getTime())) {
      throw new ApiError(400, 'Invalid procedureDate format.');
    }

    const updatedFollowUpDays =
      data.followUpDays !== undefined ? Number(data.followUpDays) : existing.followUpDays;

    if (!Number.isInteger(updatedFollowUpDays) || updatedFollowUpDays < 1) {
      throw new ApiError(400, 'followUpDays must be a positive integer.');
    }

    // Recalculate nextControlDate if procedureDate or followUpDays changed (unless explicitly overridden)
    let nextControlDate = existing.nextControlDate;
    if (data.nextControlDate) {
      nextControlDate = new Date(data.nextControlDate);
    } else if (data.procedureDate !== undefined || data.followUpDays !== undefined) {
      nextControlDate = this.calculateNextControlDate(updatedProcDate, updatedFollowUpDays);
    }

    return await prisma.procedure.update({
      where: { id },
      data: {
        ...(data.procedureName !== undefined && { procedureName: data.procedureName.trim() }),
        ...(data.procedureCode !== undefined && { procedureCode: data.procedureCode?.trim() || null }),
        ...(data.dentistName !== undefined && { dentistName: data.dentistName?.trim() || null }),
        ...(data.procedureDate !== undefined && { procedureDate: updatedProcDate }),
        ...(data.followUpDays !== undefined && { followUpDays: updatedFollowUpDays }),
        nextControlDate,
        ...(data.status !== undefined && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }
}
