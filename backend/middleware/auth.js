const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware to authenticate requests
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'No authorization token provided',
          statusCode: 401
        }
      });
    }

    const token = authHeader.substring(7);

    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid or expired token',
          statusCode: 401
        }
      });
    }

    // Get user profile from our custom users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch user profile',
          statusCode: 500
        }
      });
    }

    // Add user info to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      fullName: profile.full_name,
      phone: profile.phone
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Authentication failed',
        statusCode: 500
      }
    });
  }
};

// Middleware to check if user has required role
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User not authenticated',
          statusCode: 401
        }
      });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Access denied. Required role: ${requiredRole}`,
          statusCode: 403
        }
      });
    }

    next();
  };
};

// Middleware to check if user is an authority
const requireAuthority = requireRole('authority');

// Middleware to check if user is a citizen
const requireCitizen = requireRole('citizen');

module.exports = {
  authenticate,
  requireRole,
  requireAuthority,
  requireCitizen
};
