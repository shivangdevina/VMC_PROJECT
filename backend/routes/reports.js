const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const mlApiService = require('../services/mlApi');
const notificationService = require('../services/notifications');
const { authenticate, requireAuthority } = require('../middleware/auth');
const { upload, processImages, handleUploadError } = require('../middleware/upload');
const { 
  validate, 
  reportCreationSchema, 
  reportUpdateSchema, 
  reportStatusUpdateSchema,
  reportQuerySchema 
} = require('../utils/validation');

// GET /api/reports - Get reports (with filtering and pagination)
router.get('/', authenticate, validate(reportQuerySchema, 'query'), async (req, res) => {
  try {
    const isAuthority = req.user.role === 'authority';
    const filters = req.query;

    const result = await supabaseService.getReports(
      filters,
      req.user.id,
      isAuthority
    );

    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.count
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch reports',
        statusCode: 500
      }
    });
  }
});

// GET /api/reports/:id - Get specific report
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const isAuthority = req.user.role === 'authority';

    const report = await supabaseService.getReport(id, req.user.id, isAuthority);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Report not found',
          statusCode: 404
        }
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch report',
        statusCode: 500
      }
    });
  }
});

// POST /api/reports - Create new report
router.post('/', 
  authenticate,
  upload,
  handleUploadError,
  processImages,
  validate(reportCreationSchema),
  async (req, res) => {
    try {
      const { title, description, latitude, longitude, locationDescription, priority } = req.body;
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'At least one image or video is required',
            statusCode: 400
          }
        });
      }

      // Upload files to Supabase Storage
      const uploadedFiles = [];
      const mediaUrls = [];
      const mediaTypes = [];

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const fileName = `${req.user.id}/${Date.now()}_${i}.${file.mimetype.split('/')[1]}`;
        
        try {
          await supabaseService.uploadFile('reports', fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

          const publicUrl = supabaseService.getPublicUrl('reports', fileName);
          uploadedFiles.push(fileName);
          mediaUrls.push(publicUrl);
          mediaTypes.push(file.mimetype);
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          // Cleanup any uploaded files
          for (const uploadedFile of uploadedFiles) {
            try {
              await supabaseService.deleteFile('reports', uploadedFile);
            } catch (cleanupError) {
              console.error('Cleanup error:', cleanupError);
            }
          }
          throw new Error('Failed to upload media files');
        }
      }

      let hazardType = 'other';
      let confidence = 0;

      // Process with ML API for images
      const imageFiles = req.files.filter(file => file.mimetype.startsWith('image/'));
      if (imageFiles.length > 0) {
        try {
          const mlResult = await mlApiService.detectHazard(imageFiles[0].buffer, imageFiles[0].mimetype);
          hazardType = mlResult.hazardType;
          confidence = mlResult.confidence;
        } catch (mlError) {
          console.error('ML API error:', mlError);
          // Continue without ML detection
        }
      }

      // Create report in database
      const reportData = {
        user_id: req.user.id,
        title,
        description,
        hazard_type: hazardType,
        confidence_score: confidence,
        media_url: mediaUrls,
        media_type: mediaTypes,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        location_description: locationDescription,
        priority: priority || 1
      };

      const report = await supabaseService.createReport(reportData);

      // Send notification to authorities
      try {
        await notificationService.notifyAuthoritiesNewReport(report);
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
        // Don't fail the request if notification fails
      }

      res.status(201).json({
        success: true,
        message: 'Report created successfully',
        data: {
          ...report,
          mlDetection: {
            hazardType,
            confidence
          }
        }
      });
    } catch (error) {
      console.error('Create report error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to create report',
          statusCode: 500
        }
      });
    }
  }
);

// PUT /api/reports/:id - Update report (citizens can only update their own)
router.put('/:id', 
  authenticate,
  validate(reportUpdateSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const isAuthority = req.user.role === 'authority';

      // Citizens can only update their own pending reports
      if (!isAuthority) {
        const existingReport = await supabaseService.getReport(id, req.user.id, false);
        if (!existingReport) {
          return res.status(404).json({
            success: false,
            error: {
              message: 'Report not found',
              statusCode: 404
            }
          });
        }

        if (existingReport.status !== 'pending') {
          return res.status(403).json({
            success: false,
            error: {
              message: 'Cannot update report that is no longer pending',
              statusCode: 403
            }
          });
        }
      }

      const updatedReport = await supabaseService.updateReport(
        id, 
        updates, 
        req.user.id, 
        isAuthority
      );

      res.json({
        success: true,
        message: 'Report updated successfully',
        data: updatedReport
      });
    } catch (error) {
      console.error('Update report error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update report',
          statusCode: 500
        }
      });
    }
  }
);

// PATCH /api/reports/:id/status - Update report status (authorities only)
router.patch('/:id/status',
  authenticate,
  requireAuthority,
  validate(reportStatusUpdateSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, assignedTo, resolutionNotes } = req.body;

      // Get current report to check if status actually changed
      const currentReport = await supabaseService.getReport(id, null, true);
      if (!currentReport) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Report not found',
            statusCode: 404
          }
        });
      }

      const updates = {
        status,
        assigned_to: assignedTo || req.user.id,
        resolution_notes: resolutionNotes
      };

      const updatedReport = await supabaseService.updateReport(id, updates, null, true);

      // Send notification to citizen if status changed
      if (currentReport.status !== status) {
        try {
          await notificationService.notifyReportStatusChange(
            id,
            status,
            currentReport.user_id
          );
        } catch (notificationError) {
          console.error('Status notification error:', notificationError);
        }
      }

      res.json({
        success: true,
        message: 'Report status updated successfully',
        data: updatedReport
      });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update report status',
          statusCode: 500
        }
      });
    }
  }
);

// DELETE /api/reports/:id - Delete report (citizens can only delete their own pending reports)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Only citizens can delete their own reports, and only if pending
    if (req.user.role !== 'citizen') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Only citizens can delete their own reports',
          statusCode: 403
        }
      });
    }

    const existingReport = await supabaseService.getReport(id, req.user.id, false);
    if (!existingReport) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Report not found',
          statusCode: 404
        }
      });
    }

    if (existingReport.status !== 'pending') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Cannot delete report that is no longer pending',
          statusCode: 403
        }
      });
    }

    // Delete media files from storage
    if (existingReport.media_url && existingReport.media_url.length > 0) {
      for (const mediaUrl of existingReport.media_url) {
        try {
          // Extract file path from URL
          const urlParts = mediaUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const filePath = `${req.user.id}/${fileName}`;
          await supabaseService.deleteFile('reports', filePath);
        } catch (deleteError) {
          console.error('Media deletion error:', deleteError);
          // Continue even if media deletion fails
        }
      }
    }

    await supabaseService.deleteReport(id, req.user.id);

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete report',
        statusCode: 500
      }
    });
  }
});

// GET /api/reports/:id/history - Get report status history
router.get('/:id/history', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const isAuthority = req.user.role === 'authority';

    // Check if user can access this report
    const report = await supabaseService.getReport(id, req.user.id, isAuthority);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Report not found',
          statusCode: 404
        }
      });
    }

    const history = await supabaseService.getReportStatusHistory(id);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch report history',
        statusCode: 500
      }
    });
  }
});

// GET /api/reports/statistics - Get report statistics (authorities only)
router.get('/statistics', 
  authenticate, 
  requireAuthority, 
  async (req, res) => {
    try {
      const filters = req.query;
      const statistics = await supabaseService.getReportStatistics(filters);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch statistics',
          statusCode: 500
        }
      });
    }
  }
);

module.exports = router;
