import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { requireAdmin } from '../../middleware/auth';
import { AppError } from '../../utils/AppError';
import { getImage, storeImage } from './media.service';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB (phone photos)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

async function uploadImage(req: Request, res: Response) {
  if (!req.file) throw AppError.badRequest('Attach an image in the "file" field');
  res.status(201).json(await storeImage(req.file, req.user!.id));
}

async function serveImage(req: Request, res: Response) {
  const img = await getImage(String(req.params.id));
  res.set({
    'Content-Type': img.contentType,
    // Content never changes for a given id, so caches may keep it forever.
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Allow the storefront (a different origin) to embed these images.
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.set('Content-Length', String(img.data.length));
  res.end(img.data);
}

export const mediaRouter = Router();

mediaRouter.post('/', ...requireAdmin, upload.single('file'), uploadImage);
mediaRouter.get('/:id', serveImage);
