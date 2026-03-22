import { Router } from 'express';
import multer from 'multer';
import { uploadsDir } from '../config/uploadsPath.js';
import { uploadFile } from '../controllers/uploadController.js';
import { authMiddleware } from '../middleware/auth.js';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const r = Router();
r.post('/', authMiddleware, upload.single('file'), uploadFile);

export default r;
