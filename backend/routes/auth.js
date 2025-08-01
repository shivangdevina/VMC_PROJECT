const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const { validate, userRegistrationSchema, userLoginSchema } = require('../utils/validation');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', validate(userRegistrationSchema), async (req, res) => {
  try {
    const { email, password, role, fullName, phone } = req.body;

    const userData = await supabaseService.signUp(email, password, {
      role,
      fullName,
      phone
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        user: {
          id: userData.user.id,
          email: userData.user.email,
          role,
          fullName,
          phone
        },
        session: userData.session
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.message.includes('User already registered')) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'User with this email already exists',
          statusCode: 409
        }
      });
    }

    res.status(400).json({
      success: false,
      error: {
        message: error.message || 'Registration failed',
        statusCode: 400
      }
    });
  }
});

// POST /api/auth/login
router.post('/login', validate(userLoginSchema), async (req, res) => {
  console.log('Login request body:', req.body);
  try {
    const { email, password } = req.body;

    const authData = await supabaseService.signIn(email, password);

    if (!authData.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid credentials',
          statusCode: 401
        }
      });
    }

    // Get user profile
    const profile = await supabaseService.getUserProfile(authData.user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: profile.role,
          fullName: profile.full_name,
          phone: profile.phone
        },
        session: authData.session
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.message.includes('Invalid login credentials')) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid email or password',
          statusCode: 401
        }
      });
    }

    res.status(400).json({
      success: false,
      error: {
        message: error.message || 'Login failed',
        statusCode: 400
      }
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    const token = req.headers.authorization.substring(7);
    await supabaseService.signOut(token);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Logout failed',
        statusCode: 500
      }
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const profile = await supabaseService.getUserProfile(req.user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          role: profile.role,
          fullName: profile.full_name,
          phone: profile.phone,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at
        }
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch user profile',
        statusCode: 500
      }
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Refresh token is required',
          statusCode: 400
        }
      });
    }

    const { data, error } = await supabaseService.anonClient.auth.refreshSession({
      refresh_token
    });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        session: data.session
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid or expired refresh token',
        statusCode: 401
      }
    });
  }
});

module.exports = router;
