import prisma from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { NotificationChannel, Prisma } from '@prisma/client';

export interface CreatePatientInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  birthDate?: string;
  gender?: string;
  preferredChannel?: NotificationChannel;
  clinicalNotes?: string;
  notes?: string;
}

export interface UpdatePatientInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  birthDate?: string;
  gender?: string;
  preferredChannel?: NotificationChannel;
  clinicalNotes?: string;
  notes?: string;
  isActive?: boolean;
}

export class PatientService {
  /**
   * Create a new patient profile
   */
  static async createPatient(data: CreatePatientInput) {
    try {
      const dob = data.dateOfBirth ?? data.birthDate;
      const notes = data.clinicalNotes ?? data.notes;

      return await prisma.patient.create({
        data: {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone.trim(),
          dateOfBirth: dob ? new Date(dob) : null,
          gender: data.gender?.trim() || null,
          preferredChannel: data.preferredChannel ?? NotificationChannel.WHATSAPP,
          clinicalNotes: notes?.trim() || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[])?.join(', ') || 'email';
        throw new ApiError(409, `A patient with this ${target} already exists.`);
      }
      throw error;
    }
  }

  /**
   * Retrieve all patients with optional search filter and pagination
   */
  static async getAllPatients(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: Prisma.PatientWhereInput = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patientProcedures: {
            orderBy: { followUpDueDate: 'asc' },
          },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    return {
      data: patients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieve a single patient by ID
   */
  static async getPatientById(id: string) {
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        patientProcedures: {
          orderBy: { procedureDate: 'desc' },
        },
      },
    });

    if (!patient) {
      throw new ApiError(404, `Patient with ID ${id} not found.`);
    }

    return patient;
  }

  /**
   * Update an existing patient profile
   */
  static async updatePatient(id: string, data: UpdatePatientInput) {
    await this.getPatientById(id);

    const dob = data.dateOfBirth !== undefined ? data.dateOfBirth : data.birthDate;
    const notes = data.clinicalNotes !== undefined ? data.clinicalNotes : data.notes;

    try {
      return await prisma.patient.update({
        where: { id },
        data: {
          ...(data.firstName !== undefined && { firstName: data.firstName.trim() }),
          ...(data.lastName !== undefined && { lastName: data.lastName.trim() }),
          ...(data.email !== undefined && { email: data.email.trim().toLowerCase() }),
          ...(data.phone !== undefined && { phone: data.phone.trim() }),
          ...(dob !== undefined && {
            dateOfBirth: dob ? new Date(dob) : null,
          }),
          ...(data.gender !== undefined && { gender: data.gender?.trim() || null }),
          ...(data.preferredChannel !== undefined && { preferredChannel: data.preferredChannel }),
          ...(notes !== undefined && { clinicalNotes: notes?.trim() || null }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[])?.join(', ') || 'email';
        throw new ApiError(409, `Another patient already uses this ${target}.`);
      }
      throw error;
    }
  }
}
