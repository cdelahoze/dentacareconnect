import { Request, Response, NextFunction } from 'express';
import { NotificationChannel } from '@prisma/client';
import { ControlEngineService } from '../services/controlEngine.service';
import { executeControlEngineJob, getControlEngineSchedulerStatus } from '../jobs/controlEngine.job';
import { ApiError } from '../utils/ApiError';
import { FollowUpUrgency } from '../types/controlEngine.types';

const VALID_URGENCIES: ReadonlySet<string> = new Set<FollowUpUrgency>([
  'OVERDUE',
  'DUE_TODAY',
  'UPCOMING',
]);

const VALID_CHANNELS: ReadonlySet<string> = new Set<string>(
  Object.values(NotificationChannel)
);

const parseOptionalDate = (raw: unknown, fieldName: string): Date | undefined => {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string') {
    throw new ApiError(400, `Invalid ${fieldName} format. Expected ISO date string.`);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, `Invalid ${fieldName} value: "${raw}".`);
  }
  return parsed;
};

const parseOptionalWindowDays = (raw: unknown): number | undefined => {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 365) {
    throw new ApiError(400, 'windowDays must be an integer between 0 and 365.');
  }
  return parsed;
};

/**
 * GET /api/control-engine/queue
 * Inspect today's (or a specified date's) generated pending follow-up queue.
 */
export const getFollowUpQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawUrgency =
      typeof req.query.urgency === 'string' ? req.query.urgency.toUpperCase() : undefined;
    if (rawUrgency && !VALID_URGENCIES.has(rawUrgency)) {
      throw new ApiError(
        400,
        'Invalid urgency filter. Allowed values: OVERDUE, DUE_TODAY, UPCOMING.'
      );
    }

    const rawChannel =
      typeof req.query.channel === 'string' ? req.query.channel.toUpperCase() : undefined;
    if (rawChannel && !VALID_CHANNELS.has(rawChannel)) {
      throw new ApiError(
        400,
        'Invalid channel filter. Allowed values: EMAIL, WHATSAPP, SMS.'
      );
    }

    const date = parseOptionalDate(req.query.date, 'date');

    const queueData = await ControlEngineService.getDailyFollowUpQueue({
      date,
      urgency: rawUrgency as FollowUpUrgency | undefined,
      channel: rawChannel as NotificationChannel | undefined,
    });

    res.status(200).json({
      success: true,
      scheduler: getControlEngineSchedulerStatus(),
      data: queueData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/control-engine/run
 * Manually trigger the daily control engine for testing or administrative execution.
 */
export const triggerControlEngineRun = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const windowDays = parseOptionalWindowDays(body.windowDays ?? req.query.windowDays);
    const referenceDate = parseOptionalDate(
      body.referenceDate ?? req.query.referenceDate,
      'referenceDate'
    );
    const rawDryRun = body.dryRun ?? req.query.dryRun;
    const dryRun = rawDryRun === true || rawDryRun === 'true';

    const result = await executeControlEngineJob('manual', {
      windowDays,
      referenceDate,
      dryRun,
    });

    if (!result) {
      throw new ApiError(409, 'Control engine run is already in progress. Please retry shortly.');
    }

    res.status(200).json({
      success: true,
      message: dryRun
        ? 'Control engine dry-run completed successfully.'
        : 'Daily control engine executed successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
