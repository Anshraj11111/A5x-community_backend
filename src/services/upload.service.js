import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

// Configure Cloudinary (same config as upload.js middleware)
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key:    env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

/**
 * Returns the Cloudinary URL from a multer-storage-cloudinary file object.
 * req.file.path  → full Cloudinary HTTPS URL  ✅
 * req.file.filename → just the public_id       ❌ (don't use this)
 */
export const getFileUrl = (fileOrPath) => {
  // When called with req.file, use .path (Cloudinary URL)
  if (fileOrPath && typeof fileOrPath === 'object' && fileOrPath.path) {
    return fileOrPath.path;
  }
  // When called with a string that is already a full URL, return as-is
  if (typeof fileOrPath === 'string' && fileOrPath.startsWith('http')) {
    return fileOrPath;
  }
  // Legacy: treat as Cloudinary public_id and build URL
  if (typeof fileOrPath === 'string' && fileOrPath) {
    return cloudinary.url(fileOrPath, { secure: true });
  }
  return null;
};

/**
 * Delete an image from Cloudinary by its URL or public_id.
 */
export const deleteFile = async (fileUrl) => {
  try {
    if (!fileUrl) return;

    let publicId;
    if (fileUrl.startsWith('http')) {
      // Extract public_id from Cloudinary URL
      // URL format: https://res.cloudinary.com/<cloud>/image/upload/v<ver>/<folder>/<id>.<ext>
      const urlParts = fileUrl.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      if (uploadIndex !== -1) {
        // Everything after 'upload/v<version>/' is the public_id (without extension)
        const withVersion = urlParts.slice(uploadIndex + 1).join('/');
        // Remove version segment (v1234567890/)
        const withoutVersion = withVersion.replace(/^v\d+\//, '');
        // Remove file extension
        publicId = withoutVersion.replace(/\.[^/.]+$/, '');
      }
    } else {
      publicId = fileUrl;
    }

    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (err) {
    console.warn('Failed to delete Cloudinary file:', err.message);
  }
};
