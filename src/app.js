import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { env } from './config/env.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import postRoutes from './routes/post.routes.js';
import commentRoutes from './routes/comment.routes.js';
import featureRoutes from './routes/feature.routes.js';
import bugRoutes from './routes/bug.routes.js';
import clubRoutes from './routes/club.routes.js';
import showcaseRoutes from './routes/showcase.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminRoutes from './routes/admin.routes.js';
import productUpdateRoutes from './routes/productUpdate.routes.js';

const app = express();

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile, Postman, server-to-server)
    if (!origin) return callback(null, true);

    const allowed = env.CLIENT_URL || '';
    // Strip trailing slash for comparison
    const cleanAllowed = allowed.replace(/\/$/, '');
    const cleanOrigin  = origin.replace(/\/$/, '');

    // Exact match OR any Vercel preview deployment OR any a5x.in subdomain
    const isAllowed =
      cleanOrigin === cleanAllowed ||
      cleanOrigin.endsWith('.vercel.app') ||
      cleanOrigin === 'https://a5x.in' ||
      cleanOrigin.endsWith('.a5x.in');

    if (isAllowed) return callback(null, true);
    callback(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
app.use(globalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize MongoDB queries
app.use(mongoSanitize());

// Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Serve uploaded files statically
app.use('/uploads', express.static(join(__dirname, '../../uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
const API_PREFIX = '/api/v1';
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/posts`, postRoutes);
app.use(`${API_PREFIX}/comments`, commentRoutes);
app.use(`${API_PREFIX}/features`, featureRoutes);
app.use(`${API_PREFIX}/bugs`, bugRoutes);
app.use(`${API_PREFIX}/clubs`, clubRoutes);
app.use(`${API_PREFIX}/showcase`, showcaseRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/updates`, productUpdateRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
