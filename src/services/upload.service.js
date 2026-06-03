import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_DIR = join(__dirname, '../../../uploads');

// Returns the full public URL for an uploaded file
export const getFileUrl = (filename) => {
  const baseUrl = env.CLIENT_URL.includes('localhost')
    ? `http://localhost:${env.PORT || 4000}`
    : env.CLIENT_URL.replace('5173', env.PORT || '4000');
  return `/uploads/${filename}`;
};

// Delete a file from local disk
export const deleteFile = (fileUrl) => {
  try {
    if (!fileUrl) return;
    const filename = path.basename(fileUrl);
    const filePath = join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('Failed to delete file:', err.message);
  }
};
