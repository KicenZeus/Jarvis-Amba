const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const profileRoutes = require('./profile');
const personalityRoutes = require('./personality');
const tasksRoutes = require('./tasks');
const schedulesRoutes = require('./schedules');
const remindersRoutes = require('./reminders');
const financeRoutes = require('./finance');
const memoriesRoutes = require('./memories');
const conversationsRoutes = require('./conversations');
const notificationsRoutes = require('./notifications');
const devicesRoutes = require('./devices');
const approvalsRoutes = require('./approvals');
const syncRoutes = require('./sync');
const mediaRoutes = require('./media');
const systemRoutes = require('./system');
const dashboardRoutes = require('./dashboard');

// Mounting seluruh router modular V3 di bawah /api/v1/
router.use('/dashboard', dashboardRoutes);
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/personality', personalityRoutes);
router.use('/preferences', personalityRoutes);
router.use('/tasks', tasksRoutes);
router.use('/schedules', schedulesRoutes);
router.use('/reminders', remindersRoutes);
router.use('/finance', financeRoutes);
router.use('/memories', memoriesRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/devices', devicesRoutes);
router.use('/approvals', approvalsRoutes);
router.use('/sync', syncRoutes);
router.use('/media', mediaRoutes);
router.use('/system', systemRoutes);

module.exports = router;

