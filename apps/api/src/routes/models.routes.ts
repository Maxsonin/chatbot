import { Router } from 'express';

import { getModels } from '../services/model.service.js';

const router = Router();

router.get('/models', (req, res) => {
  res.json(getModels());
});

export default router;
