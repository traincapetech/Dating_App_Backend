import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
// Increase body size limit to 50MB for image uploads (base64 encoded images can be large)
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));
app.use(morgan('dev'));

// Serve static files for local uploads
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.use('/api', apiRouter);
app.use('/api/swipe', swipeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/users', blockRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/boost', boostRoutes);

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

app.use(errorHandler);

export default app;
