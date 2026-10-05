import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import * as ctrl from './order.controller';

export const orderRouter = Router();

orderRouter.use(requireAuth);

// Customer
orderRouter.post('/', requireRole('customer'), ctrl.create);
orderRouter.get('/mine', ctrl.listMine);
orderRouter.post('/:id/cancel', requireRole('customer'), ctrl.cancel);

// Admin
orderRouter.get('/', requireRole('admin'), ctrl.listAll);
orderRouter.patch('/:id/status', requireRole('admin'), ctrl.updateStatus);
orderRouter.patch('/:id/payment', requireRole('admin'), ctrl.updatePayment);

// Owner or admin
orderRouter.get('/:id', ctrl.getOne);
