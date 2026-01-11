import multer from 'multer';
import express from 'express';
import { uploadToR2, deleteFromR2 } from '../utils/r2Upload.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/helpers.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * @desc    Upload file to R2
 * @route   POST /api/upload
 * @access  Private
 */
router.post(
  '/',
  protect,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return sendError(res, 'No file provided', 400);
    }

    const folder = req.body.folder || 'uploads';
    const result = await uploadToR2(req.file, folder);

    sendSuccess(res, result, 'File uploaded successfully');
  })
);

/**
 * @desc    Delete file from R2
 * @route   DELETE /api/upload
 * @access  Private
 */
router.delete(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const { key } = req.body;

    if (!key) {
      return sendError(res, 'File key is required', 400);
    }

    const result = await deleteFromR2(key);

    sendSuccess(res, result, 'File deleted successfully');
  })
);

// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'File size is too large. Max 5MB allowed', 400);
    }
    return sendError(res, error.message, 400);
  }
  next(error);
});

export default router;
