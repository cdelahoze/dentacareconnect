import cron, { ScheduledTask, TaskOptions } from 'node-cron';
import { env } from '../config/env';
import { ControlEngineService } from '../services/controlEngine.service';
import {
  ControlEngineRunOptions,
  ControlEngineRunResult,
  SchedulerStatus,
} from '../types/controlEngine.types';

export type ControlEngineTrigger = 'cron' | 'manual';

interface ControlEngineLogPayload {
  service: 'control-engine';
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

let scheduledTask: ScheduledTask | null = null;
let isExecuting = false;
let lastRunAt: string | null = null;
let lastRunDurationMs: number | null = null;
let lastError: string | null = null;

const logStructured = (level: 'info' | 'warn' | 'error', event: string, details: Record<string, unknown> = {}): void => {
  const payload: ControlEngineLogPayload = {
    service: 'control-engine',
    event,
    timestamp: new Date().toISOString(),
    ...details,
  };

  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
};

/**
 * Execute a single control engine run with overlap protection and structured logging.
 * Returns null if another execution is already in progress.
 */
export const executeControlEngineJob = async (
  trigger: ControlEngineTrigger = 'cron',
  options: ControlEngineRunOptions = {}
): Promise<ControlEngineRunResult | null> => {
  if (isExecuting) {
    logStructured('warn', 'control_engine_run_skipped_overlap', { trigger });
    return null;
  }

  isExecuting = true;
  const startedAt = new Date().toISOString();

  logStructured('info', 'control_engine_run_started', {
    trigger,
    startedAt,
    windowDays: options.windowDays ?? env.REMINDER_WINDOW_DAYS,
    dryRun: options.dryRun ?? false,
  });

  try {
    const result = await ControlEngineService.runDailyControlEngine(options);
    lastRunAt = result.completedAt;
    lastRunDurationMs = result.durationMs;
    lastError = null;

    logStructured('info', 'control_engine_run_completed', {
      trigger,
      runId: result.runId,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      dryRun: result.dryRun,
      summary: result.summary,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown control engine error';
    lastRunAt = new Date().toISOString();
    lastError = message;

    logStructured('error', 'control_engine_run_failed', {
      trigger,
      startedAt,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (trigger === 'manual') {
      throw error;
    }

    return null;
  } finally {
    isExecuting = false;
  }
};

/**
 * Register and initialize the daily midnight cron scheduler.
 * Non-blocking and safe to call on server startup.
 */
export const startControlEngineScheduler = (): ScheduledTask | null => {
  if (!env.ENABLE_CRON) {
    logStructured('info', 'control_engine_scheduler_disabled', {
      enableCron: env.ENABLE_CRON,
    });
    return null;
  }

  if (scheduledTask) {
    logStructured('warn', 'control_engine_scheduler_already_initialized', {
      schedule: env.CRON_SCHEDULE,
    });
    return scheduledTask;
  }

  if (!cron.validate(env.CRON_SCHEDULE)) {
    const message = `Invalid CRON_SCHEDULE expression: "${env.CRON_SCHEDULE}". Scheduler not started.`;
    lastError = message;
    logStructured('error', 'control_engine_scheduler_invalid_expression', {
      schedule: env.CRON_SCHEDULE,
      message,
    });
    return null;
  }

  const taskOptions: TaskOptions = {
    name: 'daily-control-engine',
    noOverlap: true,
    ...(env.CRON_TIMEZONE ? { timezone: env.CRON_TIMEZONE } : {}),
  };

  scheduledTask = cron.schedule(
    env.CRON_SCHEDULE,
    async () => {
      await executeControlEngineJob('cron');
    },
    taskOptions
  );

  logStructured('info', 'control_engine_scheduler_started', {
    schedule: env.CRON_SCHEDULE,
    timezone: env.CRON_TIMEZONE ?? 'system-local',
    reminderWindowDays: env.REMINDER_WINDOW_DAYS,
  });

  return scheduledTask;
};

/**
 * Stop and clean up the active cron scheduler task.
 */
export const stopControlEngineScheduler = async (): Promise<void> => {
  if (!scheduledTask) {
    return;
  }

  await scheduledTask.stop();
  await scheduledTask.destroy();
  scheduledTask = null;

  logStructured('info', 'control_engine_scheduler_stopped');
};

/**
 * Return current scheduler runtime status for observability endpoints.
 */
export const getControlEngineSchedulerStatus = (): SchedulerStatus => ({
  enabled: env.ENABLE_CRON,
  running: scheduledTask !== null,
  isExecuting,
  schedule: env.CRON_SCHEDULE,
  timezone: env.CRON_TIMEZONE ?? null,
  lastRunAt,
  lastRunDurationMs,
  lastError,
});
