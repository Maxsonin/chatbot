import { Router } from 'express';

import chatRouter from './chat.routes.js';
import modelsRoutes from './models.routes.js';

const router = Router();

router.use(modelsRoutes);
router.use(chatRouter);

export default router;
