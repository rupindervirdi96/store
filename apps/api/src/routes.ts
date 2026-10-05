import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { orderRouter } from './modules/orders/order.routes';
import { productRouter } from './modules/products/product.routes';
import { userRouter } from './modules/users/user.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/orders', orderRouter);
