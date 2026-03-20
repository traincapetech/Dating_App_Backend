import express from 'express';
import cors from 'cors';
import path from 'path';
import {fileURLToPath} from 'url';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import apiRouter from './routes/index.js';
import {errorHandler} from './middlewares/errorHandler.js';
import swipeRoutes from './routes/swipeRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import blockRoutes from './routes/blockRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import boostRoutes from './routes/boostRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import photoSocialRoutes from './routes/photoSocialRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import streakRoutes from './modules/streak/streak.routes.js';
import {
  generalLimiter,
  swipeLimiter,
  messageLimiter,
  uploadLimiter,
} from './middlewares/rateLimiter.js';
import requestLogger from './middlewares/requestLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

// Security Headers
app.use(helmet());

// Compress responses
app.use(compression());

// CORS Configuration - Allow specific origins or keep open for mobile app APIs but with security in mind
app.use(
  cors({
    origin: '*', // For mobile apps, often '*' is used, but for web clients restrict this.
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Device-Id',
      'x-user-id',
    ],
    credentials: true,
  }),
);

// Body Parser
// Increase body size limit to 50MB for image uploads (base64 encoded images can be large)
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

// Data Sanitization against NoSQL Query Injection
app.use(mongoSanitize());

// Use custom structured logger instead of morgan
app.use(requestLogger);

// Apply general rate limiting to all API routes
app.use('/api', generalLimiter);

// Serve static files for local uploads
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.use('/api', apiRouter);
app.use('/api/swipe', swipeLimiter, swipeRoutes);
app.use('/api/chat', messageLimiter, chatRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/users', blockRoutes);
app.use('/api/media', uploadLimiter, mediaRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/boost', boostRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/photo-social', photoSocialRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/support', supportRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({status: 'ok'});
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Pryvo API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
    },
  });
});

// Custom 404 handler
app.use((req, res, next) => {
  console.log(`[404] Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Not Found',
    message: `The endpoint ${req.originalUrl} does not exist on this server.`,
    path: req.originalUrl,
    method: req.method
  });
});

app.use(errorHandler);

export default app;
