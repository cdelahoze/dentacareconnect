import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

/**
 * GET /api/health
 * Basic server connectivity and runtime verification
 */
export const getHealthStatus = (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    status: 'online',
    service: 'DentaCare Connect API',
    version: '1.0.0',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} seconds`,
  });
};

/**
 * GET /api/health/db
 * Deep health check verifying PostgreSQL connectivity via Prisma ORM
 */
export const getDatabaseHealthStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;

    res.status(200).json({
      success: true,
      status: 'connected',
      database: 'PostgreSQL (Prisma ORM)',
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(
      new ApiError(
        503,
        `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
  }
};
