import { Router } from 'express';
import { optionalAuth, requireAdmin } from '../../middleware/auth';
import * as ctrl from './product.controller';

export const productRouter = Router();

// Public catalog (admins additionally see inactive products).
productRouter.get('/', optionalAuth, ctrl.list);
productRouter.get('/categories', ctrl.categories);
productRouter.get('/:id', optionalAuth, ctrl.getOne);

// Inventory management.
productRouter.post('/', ...requireAdmin, ctrl.create);
productRouter.patch('/:id', ...requireAdmin, ctrl.update);
productRouter.patch('/:id/stock', ...requireAdmin, ctrl.adjustStock);
productRouter.delete('/:id', ...requireAdmin, ctrl.archive);
