import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');

export function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
}

export function uploadFile(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const publicPath = `/uploads/${req.file.filename}`;
    return res.status(201).json({
      url: publicPath,
      mime: req.file.mimetype,
      originalName: req.file.originalname,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
