import express from 'express';

import statusRoute from './status.js';
import databasesRoute from './databases.js';
import createDatabaseRoute from './createDatabase.js';
import useDatabaseRoute from './useDatabase.js';
import testConnectionRoute from './testConnection.js';
import initSchemaRoute from './initSchema.js';
import dbStatusRoute from './dbStatus.js';
import userStatusRoute from './userStatus.js';
import completeOnboardingRoute from './completeOnboarding.js';
import superadminStatusRoute from './superadminStatus.js';
import bootstrapSuperadminRoute from './bootstrapSuperadmin.js';
import superadminUserStatusRoute from './superadminUserStatus.js';
import superadminInitAccountRoute from './superadminInitAccount.js';

const router = express.Router();

router.use('/status', statusRoute);
router.use('/databases', databasesRoute);
router.use('/create-database', createDatabaseRoute);
router.use('/use-database', useDatabaseRoute);
router.use('/test-connection', testConnectionRoute);
router.use('/init-schema', initSchemaRoute);
router.use('/db-status', dbStatusRoute);
router.use('/user-status', userStatusRoute);
router.use('/complete-onboarding', completeOnboardingRoute);
router.use('/superadmin-status', superadminStatusRoute);
router.use('/bootstrap-superadmin', bootstrapSuperadminRoute);
router.use('/superadmin-user-status', superadminUserStatusRoute);
router.use('/superadmin-init-account', superadminInitAccountRoute);

export default router;
