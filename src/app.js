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

app.use(errorHandler);

export default app;
