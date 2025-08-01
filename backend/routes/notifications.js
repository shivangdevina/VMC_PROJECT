const express = require('express');
const router = express.Router();
const notificationService = require('../services/notifications');
const { authenticate, requireAuthority } = require('../middleware/auth');
const { validate, pushTokenSchema } = require('../utils/validation');
const Joi = require('joi');

// POST /api/notifications/register-token - Register push notification token
router.post('/register-token', 
  authenticate, 
  validate(pushTokenSchema), 
  async (req, res) => {
    try {
      const { token, platform } = req.body;
      
      const result = await notificationService.registerPushToken(
        req.user.id, 
        token, 
        platform
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          error: {
            message: result.error,
            statusCode: 400
          }
        });
      }
    } catch (error) {
      console.error('Register token error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to register push token',
          statusCode: 500
        }
      });
    }
  }
);

// DELETE /api/notifications/token/:token - Remove push notification token
router.delete('/token/:token', authenticate, async (req, res) => {
  try {
    const { token } = req.params;
    
    const result = await notificationService.removePushToken(token);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          message: result.error,
          statusCode: 400
        }
      });
    }
  } catch (error) {
    console.error('Remove token error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to remove push token',
        statusCode: 500
      }
    });
  }
});

// POST /api/notifications/test - Send test notification
router.post('/test', authenticate, async (req, res) => {
  try {
    const result = await notificationService.sendTestNotification(req.user.id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test notification sent successfully',
        data: {
          messagesSent: result.messagesSent
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          message: result.error || 'Failed to send test notification',
          statusCode: 400
        }
      });
    }
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to send test notification',
        statusCode: 500
      }
    });
  }
});

// Schema for bulk notification
const bulkNotificationSchema = Joi.object({
  userIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  title: Joi.string().min(1).max(100).required(),
  body: Joi.string().min(1).max(500).required(),
  data: Joi.object().optional()
});

// POST /api/notifications/bulk - Send bulk notification (authorities only)
router.post('/bulk', 
  authenticate, 
  requireAuthority,
  validate(bulkNotificationSchema),
  async (req, res) => {
    try {
      const { userIds, title, body, data } = req.body;
      
      const result = await notificationService.sendBulkNotification(
        userIds, 
        title, 
        body, 
        data
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Bulk notification sent',
          data: {
            totalSent: result.totalSent,
            totalFailed: result.totalFailed,
            results: result.results
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: {
            message: result.error,
            statusCode: 400
          }
        });
      }
    } catch (error) {
      console.error('Bulk notification error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to send bulk notification',
          statusCode: 500
        }
      });
    }
  }
);

// Schema for emergency notification
const emergencyNotificationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().min(100).max(50000).required(), // meters
  title: Joi.string().min(1).max(100).required(),
  body: Joi.string().min(1).max(500).required()
});

// POST /api/notifications/emergency - Send emergency notification to area (authorities only)
router.post('/emergency',
  authenticate,
  requireAuthority,
  validate(emergencyNotificationSchema),
  async (req, res) => {
    try {
      const { latitude, longitude, radius, title, body } = req.body;
      
      const result = await notificationService.sendEmergencyNotification(
        latitude,
        longitude,
        radius,
        title,
        body
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Emergency notification sent',
          data: {
            totalSent: result.totalSent || 0,
            totalFailed: result.totalFailed || 0,
            affectedUsers: result.results?.length || 0
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: {
            message: result.error,
            statusCode: 400
          }
        });
      }
    } catch (error) {
      console.error('Emergency notification error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to send emergency notification',
          statusCode: 500
        }
      });
    }
  }
);

module.exports = router;
