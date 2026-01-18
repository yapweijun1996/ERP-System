import express from 'express';

import authRoutes from './auth.js';
import mastersRoutes from './masters.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/', mastersRoutes);

export default router;

