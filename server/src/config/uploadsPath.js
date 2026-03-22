import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preferred = path.join(__dirname, '../../uploads');

function ensureWritableUploadsDir() {
  try {
    if (!fs.existsSync(preferred)) fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), 'syncwork-uploads');
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    console.warn('[uploads] Using fallback directory:', fallback);
    return fallback;
  }
}

export const uploadsDir = ensureWritableUploadsDir();
