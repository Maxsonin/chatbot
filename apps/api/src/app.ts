import express, { type Express } from 'express';
import cors from 'cors';

import apiRouter from './routes/index.js';
import { env } from './config/env.js';

const app: Express = express();

app.use(
  cors({
    origin: env.frontendOrigin,
  }),
);
app.use(express.json());
app.use(apiRouter);

export default app;
