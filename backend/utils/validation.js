const Joi = require('joi');

// Environment validation schema
const envSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  SUPABASE_URL: Joi.string().default('https://demo-project.supabase.co'),
  SUPABASE_ANON_KEY: Joi.string().default('demo-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().default('demo-service-role-key'),
  ML_API_URL: Joi.string().default('http://localhost:8000'),
  ML_API_KEY: Joi.string().optional().allow(''),
  EXPO_ACCESS_TOKEN: Joi.string().optional().allow(''),
  MAX_FILE_SIZE: Joi.number().default(10485760),
  ALLOWED_FILE_TYPES: Joi.string().default('image/jpeg,image/png,image/webp,video/mp4,video/quicktime'),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info')
});

// User registration schema
const userRegistrationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('citizen', 'authority').default('citizen'),
  fullName: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional()
});

// User login schema
const userLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Report creation schema
const reportCreationSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  description: Joi.string().max(1000).optional(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  locationDescription: Joi.string().max(200).optional(),
  priority: Joi.number().min(1).max(3).default(1)
});

// Report update schema (for citizens)
const reportUpdateSchema = Joi.object({
  title: Joi.string().min(5).max(200).optional(),
  description: Joi.string().max(1000).optional(),
  locationDescription: Joi.string().max(200).optional(),
  priority: Joi.number().min(1).max(3).optional()
});

// Report status update schema (for authorities)
const reportStatusUpdateSchema = Joi.object({
  status: Joi.string().valid('pending', 'in_progress', 'resolved', 'rejected').required(),
  assignedTo: Joi.string().uuid().optional(),
  resolutionNotes: Joi.string().max(1000).optional()
});

// Push token registration schema
const pushTokenSchema = Joi.object({
  token: Joi.string().required(),
  platform: Joi.string().valid('ios', 'android').required()
});

// Query parameters schema for reports
const reportQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  status: Joi.string().valid('pending', 'in_progress', 'resolved', 'rejected').optional(),
  hazardType: Joi.string().valid(
    'pothole', 'damaged_road', 'fallen_tree', 'debris', 'cattle_on_road',
    'flooding', 'broken_barrier', 'traffic_light_issue', 'signage_damage', 'other'
  ).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  radius: Joi.number().min(100).max(50000).default(5000), // meters
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  sortBy: Joi.string().valid('created_at', 'updated_at', 'status', 'priority').default('created_at'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Validate environment variables
const validateEnv = () => {
  const { error, value } = envSchema.validate(process.env, {
    allowUnknown: true,
    stripUnknown: false
  });

  if (error) {
    console.error('Environment validation error:', error.details);
    process.exit(1);
  }

  return value;
};

// Generic validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const validationError = new Error('Validation Error');
      validationError.name = 'ValidationError';
      validationError.details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      return next(validationError);
    }

    // Replace the request property with the validated and sanitized value
    req[property] = value;
    next();
  };
};

// File validation
const validateFile = (file, allowedTypes = [], maxSize = 10485760) => {
  const errors = [];

  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }

  // Check file size
  if (file.size > maxSize) {
    errors.push(`File size exceeds limit of ${maxSize / 1024 / 1024}MB`);
  }

  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
    errors.push(`File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Coordinate validation
const validateCoordinates = (latitude, longitude) => {
  const errors = [];

  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    errors.push('Invalid latitude. Must be between -90 and 90');
  }

  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    errors.push('Invalid longitude. Must be between -180 and 180');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  // Schemas
  envSchema,
  userRegistrationSchema,
  userLoginSchema,
  reportCreationSchema,
  reportUpdateSchema,
  reportStatusUpdateSchema,
  pushTokenSchema,
  reportQuerySchema,

  // Validation functions
  validateEnv,
  validate,
  validateFile,
  validateCoordinates
};
