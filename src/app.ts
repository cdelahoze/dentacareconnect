import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import healthRouter from './routes/health.routes';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware';

const app: Application = express();

// Global Security & Utility Middlewares
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Base Routes
app.use('/api/health', healthRouter);

// Error Handling Middlewares (Must be registered after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
