import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import apiRouter from './routes/index.js';
import {errorHandler} from './middlewares/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api', apiRouter);

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
