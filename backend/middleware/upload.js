const multer = require('multer');
const sharp = require('sharp');
const { validateFile } = require('../utils/validation');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime'
  ];

  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB

  const validation = validateFile(file, allowedTypes, maxSize);
  
  if (!validation.isValid) {
    return cb(new Error(validation.errors.join(', ')), false);
  }

  cb(null, true);
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    files: 5 // Maximum 5 files per request
  }
});

// Middleware to process uploaded images
const processImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next();
    }

    const processedFiles = [];

    for (const file of req.files) {
      if (file.mimetype.startsWith('image/')) {
        // Process image with sharp
        const processedBuffer = await sharp(file.buffer)
          .resize(1920, 1080, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ 
            quality: 85,
            progressive: true 
          })
          .toBuffer();

        processedFiles.push({
          ...file,
          buffer: processedBuffer,
          mimetype: 'image/jpeg',
          size: processedBuffer.length,
          processed: true
        });
      } else {
        // Keep video files as-is
        processedFiles.push({
          ...file,
          processed: false
        });
      }
    }

    req.files = processedFiles;
    next();
  } catch (error) {
    console.error('Image processing error:', error);
    next(new Error('Failed to process uploaded images'));
  }
};

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'File too large',
          statusCode: 400
        }
      });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Too many files uploaded',
          statusCode: 400
        }
      });
    }
  }

  if (error.message.includes('File type') || error.message.includes('File size')) {
    return res.status(400).json({
      success: false,
      error: {
        message: error.message,
        statusCode: 400
      }
    });
  }

  next(error);
};

// Export middleware functions
module.exports = {
  upload: upload.array('media', 5), // Accept up to 5 files with field name 'media'
  uploadSingle: upload.single('media'), // Accept single file
  processImages,
  handleUploadError
};
