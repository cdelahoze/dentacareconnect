import { Prisma, TreatmentStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError } from '../utils/ApiError';

export interface CreateProcedureInput {
  patientId: string;
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
  status?: TreatmentStatus;
  notes?: string;
}

const procedureInclude = {
  patient: true,
  procedure: true,
  performedBy: true,
  appointments: {
    orderBy: { scheduledAt: 'desc' as const },
  },
  reminders: {
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.PatientProcedureInclude;

function addLegacyProcedureFields<T extends {
  procedure: { name: string; code: string | null; defaultFollowUpDays: number };
  performedBy: { firstName: string; lastName: string } | null;
  followUpDueDate: Date;
}>(record: T) {
  return {
    ...record,
    procedureName: record.procedure.name,
    procedureCode: record.procedure.code,
    followUpDays: record.procedure.defaultFollowUpDays,
    nextControlDate: record.followUpDueDate,
    dentistName: record.performedBy
      ? `${record.performedBy.firstName} ${record.performedBy.lastName}`
      : null,
  };
}

export class ProcedureService {
  private static calculateNextControlDate(baseDate: Date, followUpDays: number): Date {
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + followUpDays);
    return targetDate;
  }

  static async createProcedure(data: CreateProcedureInput) {
    const patient = await prisma.patient.findUnique({ where: { id: data.patientId } });

    if (!patient) {
      throw new ApiError(404, `Patient with ID ${data.patientId} not found.`);
    }
    if (!patient.isActive) {
      throw new ApiError(400, `Cannot log procedure for inactive patient (ID ${data.patientId}).`);
    }

    const procedureDate = data.procedureDate ? new Date(data.procedureDate) : new Date();
    if (Number.isNaN(procedureDate.getTime())) {
      throw new ApiError(400, 'Invalid procedureDate format. Use ISO-8601 date string.');
    }

    const followUpDays = Number(data.followUpDays);
    if (!Number.isInteger(followUpDays) || followUpDays < 1) {
      throw new ApiError(400, 'followUpDays must be a positive integer.');
    }

    const procedureName = data.procedureName.trim();
    const procedureCode = data.procedureCode?.trim() || null;
    const catalogProcedure =
      (await prisma.procedure.findUnique({ where: { name: procedureName } })) ??
      (procedureCode
        ? await prisma.procedure.findUnique({ where: { code: procedureCode } })
        : null) ??
      (await prisma.procedure.create({
        data: {
          name: procedureName,
          code: procedureCode,
          defaultFollowUpDays: followUpDays,
        },
      }));

    const record = await prisma.patientProcedure.create({
      data: {
        patientId: patient.id,
        procedureId: catalogProcedure.id,
        procedureDate,
        followUpDueDate: this.calculateNextControlDate(procedureDate, followUpDays),
        status: TreatmentStatus.PENDING_FOLLOWUP,
        notes: data.notes?.trim() || null,
      },
      include: procedureInclude,
    });

    return addLegacyProcedureFields(record);
  }

  static async getAllProcedures(filters?: {
    patientId?: string;
    status?: TreatmentStatus;
    dueBefore?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const where: Prisma.PatientProcedureWhereInput = {
      ...(filters?.patientId && { patientId: filters.patientId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.dueBefore && { followUpDueDate: { lte: new Date(filters.dueBefore) } }),
    };

    const [procedures, total] = await Promise.all([
      prisma.patientProcedure.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { followUpDueDate: 'asc' },
        include: procedureInclude,
      }),
      prisma.patientProcedure.count({ where }),
    ]);

    return {
      data: procedures.map(addLegacyProcedureFields),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getProcedureById(id: string) {
    const procedure = await prisma.patientProcedure.findUnique({
      where: { id },
      include: procedureInclude,
    });

    if (!procedure) {
      throw new ApiError(404, `Procedure with ID ${id} not found.`);
    }

    return addLegacyProcedureFields(procedure);
  }

  static async getProceduresByPatientId(patientId: string) {
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      throw new ApiError(404, `Patient with ID ${patientId} not found.`);
    }

    const procedures = await prisma.patientProcedure.findMany({
      where: { patientId },
      orderBy: { followUpDueDate: 'asc' },
      include: procedureInclude,
    });

    return procedures.map(addLegacyProcedureFields);
  }

  static async updateProcedure(id: string, data: UpdateProcedureInput) {
    const existing = await this.getProcedureById(id);
    const procedureDate = data.procedureDate ? new Date(data.procedureDate) : existing.procedureDate;

    if (Number.isNaN(procedureDate.getTime())) {
      throw new ApiError(400, 'Invalid procedureDate format.');
    }

    const followUpDays =
      data.followUpDays !== undefined ? Number(data.followUpDays) : existing.followUpDays;
    if (!Number.isInteger(followUpDays) || followUpDays < 1) {
      throw new ApiError(400, 'followUpDays must be a positive integer.');
    }

    let followUpDueDate = existing.followUpDueDate;
    if (data.nextControlDate) {
      followUpDueDate = new Date(data.nextControlDate);
      if (Number.isNaN(followUpDueDate.getTime())) {
        throw new ApiError(400, 'Invalid nextControlDate format.');
      }
    } else if (data.procedureDate !== undefined || data.followUpDays !== undefined) {
      followUpDueDate = this.calculateNextControlDate(procedureDate, followUpDays);
    }

    await prisma.procedure.update({
      where: { id: existing.procedureId },
      data: {
        ...(data.procedureName !== undefined && { name: data.procedureName.trim() }),
        ...(data.procedureCode !== undefined && { code: data.procedureCode?.trim() || null }),
        ...(data.followUpDays !== undefined && { defaultFollowUpDays: followUpDays }),
      },
    });

    const updated = await prisma.patientProcedure.update({
      where: { id },
      data: {
        ...(data.procedureDate !== undefined && { procedureDate }),
        followUpDueDate,
        ...(data.status !== undefined && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      },
      include: procedureInclude,
    });

    return addLegacyProcedureFields(updated);
  }
}
