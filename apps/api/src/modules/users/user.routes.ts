import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { AppError } from '../../utils/AppError';
import { UserModel, toUserDTO } from './user.model';
import { PushTokenSchema, UpdateMeSchema } from './user.schemas';

async function getMe(req: Request, res: Response) {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw AppError.notFound('User not found');
  res.json(toUserDTO(user));
}

async function updateMe(req: Request, res: Response) {
  const body = parse(UpdateMeSchema, req.body);
  const user = await UserModel.findByIdAndUpdate(req.user!.id, body, { new: true, runValidators: true });
  if (!user) throw AppError.notFound('User not found');
  res.json(toUserDTO(user));
}

async function registerPushToken(req: Request, res: Response) {
  const { token } = parse(PushTokenSchema, req.body);
  await UserModel.updateOne({ _id: req.user!.id }, { $addToSet: { pushTokens: token } });
  res.status(204).end();
}

async function removePushToken(req: Request, res: Response) {
  const { token } = parse(PushTokenSchema, req.body);
  await UserModel.updateOne({ _id: req.user!.id }, { $pull: { pushTokens: token } });
  res.status(204).end();
}

export const userRouter = Router();

userRouter.use(requireAuth);
userRouter.get('/me', getMe);
userRouter.patch('/me', updateMe);
userRouter.post('/me/push-tokens', registerPushToken);
userRouter.delete('/me/push-tokens', removePushToken);
