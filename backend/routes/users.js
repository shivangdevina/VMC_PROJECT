const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const { authenticate, requireAuthority } = require('../middleware/auth');
const { validate } = require('../utils/validation');
const Joi = require('joi');

// Schema for user profile updates
const updateProfileSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional()
});

// GET /api/users/profile - Get current user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const profile = await supabaseService.getUserProfile(req.user.id);

    res.json({
      success: true,
      data: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        fullName: profile.full_name,
        phone: profile.phone,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch user profile',
        statusCode: 500
      }
    });
  }
});

// PUT /api/users/profile - Update current user profile
router.put('/profile', 
  authenticate, 
  validate(updateProfileSchema), 
  async (req, res) => {
    try {
      const updates = {};
      
      if (req.body.fullName) {
        updates.full_name = req.body.fullName;
      }
      
      if (req.body.phone) {
        updates.phone = req.body.phone;
      }

      const updatedProfile = await supabaseService.updateUserProfile(req.user.id, updates);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: updatedProfile.id,
          email: updatedProfile.email,
          role: updatedProfile.role,
          fullName: updatedProfile.full_name,
          phone: updatedProfile.phone,
          updatedAt: updatedProfile.updated_at
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update profile',
          statusCode: 500
        }
      });
    }
  }
);

// GET /api/users - Get all users (authorities only)
router.get('/', authenticate, requireAuthority, async (req, res) => {
  try {
    const { data: users, error } = await supabaseService.client
      .from('users')
      .select('id, email, role, full_name, phone, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: users.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        phone: user.phone,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch users',
        statusCode: 500
      }
    });
  }
});

// GET /api/users/:id - Get specific user (authorities only)
router.get('/:id', authenticate, requireAuthority, async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await supabaseService.getUserProfile(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          statusCode: 404
        }
      });
    }

    res.json({
      success: true,
      data: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        fullName: profile.full_name,
        phone: profile.phone,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch user',
        statusCode: 500
      }
    });
  }
});

// GET /api/users/:id/reports - Get user's reports (authorities only)
router.get('/:id/reports', authenticate, requireAuthority, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await supabaseService.getReports(
      { page: parseInt(page), limit: parseInt(limit) },
      id,
      true // isAuthority = true to see all reports for this user
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
    console.error('Get user reports error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch user reports',
        statusCode: 500
      }
    });
  }
});

module.exports = router;
