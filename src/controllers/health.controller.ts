import { Request, Response } from 'express';

export const getHealthStatus = (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'online',
    service: 'DentaCare Connect API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} seconds`,
  });
};
