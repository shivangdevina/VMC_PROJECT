const { createClient } = require('@supabase/supabase-js');
const mockSupabase = require('./mockSupabase');

// Check if we're using mock Supabase (development mode with demo credentials)
const isUsingMockSupabase = process.env.SUPABASE_URL === 'https://demo-project.supabase.co' || 
                           process.env.SUPABASE_ANON_KEY === 'demo-anon-key';

let supabase, supabaseAnon;

if (isUsingMockSupabase) {
  console.log('🔧 Using Mock Supabase for development');
  // Mock clients - we'll handle this in the service class
  supabase = null;
  supabaseAnon = null;
} else {
  console.log('🔗 Using Real Supabase');
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  supabaseAnon = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}

class SupabaseService {
  constructor() {
    this.client = supabase;
    this.anonClient = supabaseAnon;
    this.isUsingMock = isUsingMockSupabase;
  }

  // Auth operations
  async signUp(email, password, userData) {
    if (this.isUsingMock) {
      const data = await mockSupabase.signUp(email, password, userData);
      return { data, error: null };
    }
    
    const { data, error } = await this.anonClient.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });

    if (error) {
      // Handle specific Supabase auth errors
      if (error.message.includes('User already registered')) {
        throw new Error('User with this email already exists');
      }
      throw error;
    }

    // Create user profile in our custom users table
    if (data.user) {
      const { error: profileError } = await this.client
        .from('users')
        .insert([{
          id: data.user.id,
          email: data.user.email,
          role: userData.role || 'citizen',
          full_name: userData.fullName,
          phone: userData.phone
        }]);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        
        // Handle duplicate key constraint error
        if (profileError.code === '23505' || profileError.message.includes('duplicate key')) {
          // Check if user profile already exists
          const existingProfile = await this.getUserProfile(data.user.id).catch(() => null);
          if (existingProfile) {
            console.log('User profile already exists, proceeding with existing profile');
            return data;
          }
        }
        
        throw new Error('Failed to create user profile: ' + profileError.message);
      }
    }

    return data;
  }

  async signIn(email, password) {
    if (this.isUsingMock) {
      const data = await mockSupabase.signIn(email, password);
      return { data, error: null };
    }
    
    const { data, error } = await this.anonClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  }

  async signOut(accessToken) {
    const { error } = await this.anonClient.auth.signOut(accessToken);
    if (error) throw error;
  }

  async getUser(accessToken) {
    const { data, error } = await this.client.auth.getUser(accessToken);
    if (error) throw error;
    return data;
  }

  // User operations
  async getUserProfile(userId) {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async updateUserProfile(userId, updates) {
    const { data, error } = await this.client
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Report operations
  async createReport(reportData) {
    const { data, error } = await this.client
      .from('reports')
      .insert([reportData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getReport(reportId, userId = null, isAuthority = false) {
    let query = this.client
      .from('reports_with_users')
      .select('*')
      .eq('id', reportId);

    // Apply RLS if not authority
    if (!isAuthority && userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.single();
    if (error) throw error;
    return data;
  }

  async getReports(filters = {}, userId = null, isAuthority = false) {
    let query = this.client.from('reports_with_users').select('*');

    // Apply RLS if not authority
    if (!isAuthority && userId) {
      query = query.eq('user_id', userId);
    }

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.hazardType) {
      query = query.eq('hazard_type', filters.hazardType);
    }

    if (filters.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    // Location-based filtering
    if (filters.latitude && filters.longitude && filters.radius) {
      // Use the custom function for spatial queries
      const { data: spatialData, error: spatialError } = await this.client
        .rpc('get_reports_within_radius', {
          center_lat: filters.latitude,
          center_lng: filters.longitude,
          radius_meters: filters.radius
        });

      if (spatialError) throw spatialError;

      // Get the IDs from spatial query
      const reportIds = spatialData.map(r => r.id);
      
      if (reportIds.length > 0) {
        query = query.in('id', reportIds);
      } else {
        // No reports in radius, return empty result
        return { data: [], count: 0 };
      }
    }

    // Sorting
    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const offset = (page - 1) * limit;

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return { data, count, page, limit };
  }

  async updateReport(reportId, updates, userId = null, isAuthority = false) {
    let query = this.client
      .from('reports')
      .update(updates)
      .eq('id', reportId);

    // Apply RLS if not authority
    if (!isAuthority && userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async deleteReport(reportId, userId) {
    const { data, error } = await this.client
      .from('reports')
      .delete()
      .eq('id', reportId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Storage operations
  async uploadFile(bucket, path, file, options = {}) {
    const { data, error } = await this.client.storage
      .from(bucket)
      .upload(path, file, options);

    if (error) throw error;
    return data;
  }

  async getPublicUrl(bucket, path) {
    const { data } = this.client.storage
      .from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async deleteFile(bucket, path) {
    const { data, error } = await this.client.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
    return data;
  }

  // Push token operations
  async savePushToken(userId, token, platform) {
    const { data, error } = await this.client
      .from('push_tokens')
      .upsert([{
        user_id: userId,
        token,
        platform,
        last_used: new Date().toISOString()
      }], {
        onConflict: 'token'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getPushTokens(userId) {
    const { data, error } = await this.client
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data;
  }

  async deletePushToken(token) {
    const { data, error } = await this.client
      .from('push_tokens')
      .delete()
      .eq('token', token);

    if (error) throw error;
    return data;
  }

  // Statistics and analytics
  async getReportStatistics(filters = {}) {
    let query = this.client.from('report_statistics').select('*');

    if (filters.startDate) {
      query = query.gte('report_date', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('report_date', filters.endDate);
    }

    if (filters.hazardType) {
      query = query.eq('hazard_type', filters.hazardType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Report status history
  async getReportStatusHistory(reportId) {
    const { data, error } = await this.client
      .from('report_status_history')
      .select(`
        *,
        users:changed_by (
          full_name,
          email,
          role
        )
      `)
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }
}

module.exports = new SupabaseService();
