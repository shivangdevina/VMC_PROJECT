// Mock Supabase service for development when real Supabase is not configured
class MockSupabaseService {
  constructor() {
    this.users = new Map();
    this.reports = new Map();
    this.sessions = new Map();
  }

  // Mock auth operations
  async signUp(email, password, userData) {
    const userId = `user_${Date.now()}`;
    const user = {
      id: userId,
      email,
      ...userData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.users.set(userId, user);
    
    const session = {
      access_token: `mock_token_${userId}`,
      refresh_token: `mock_refresh_${userId}`,
      expires_at: Date.now() + 3600000 // 1 hour
    };
    
    this.sessions.set(session.access_token, { user, session });
    
    return {
      user,
      session
    };
  }

  async signIn(email, password) {
    // Find user by email
    const user = Array.from(this.users.values()).find(u => u.email === email);
    
    if (!user) {
      throw new Error('Invalid login credentials');
    }
    
    const session = {
      access_token: `mock_token_${user.id}`,
      refresh_token: `mock_refresh_${user.id}`,
      expires_at: Date.now() + 3600000 // 1 hour
    };
    
    this.sessions.set(session.access_token, { user, session });
    
    return {
      user,
      session
    };
  }

  async signOut(accessToken) {
    this.sessions.delete(accessToken);
  }

  async getUser(accessToken) {
    const sessionData = this.sessions.get(accessToken);
    if (!sessionData) {
      throw new Error('Invalid token');
    }
    return { user: sessionData.user };
  }

  // Mock user operations
  async getUserProfile(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async updateUserProfile(userId, updates) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const updatedUser = { 
      ...user, 
      ...updates, 
      updated_at: new Date().toISOString() 
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Mock report operations
  async createReport(reportData) {
    const reportId = `report_${Date.now()}`;
    const report = {
      id: reportId,
      ...reportData,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.reports.set(reportId, report);
    return report;
  }

  async getReport(reportId, userId = null, isAuthority = false) {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error('Report not found');
    }
    
    // Simple access control
    if (!isAuthority && userId && report.user_id !== userId) {
      throw new Error('Access denied');
    }
    
    return report;
  }

  async getReports(filters = {}, userId = null, isAuthority = false) {
    let reports = Array.from(this.reports.values());
    
    // Apply access control
    if (!isAuthority && userId) {
      reports = reports.filter(r => r.user_id === userId);
    }
    
    // Apply filters
    if (filters.status) {
      reports = reports.filter(r => r.status === filters.status);
    }
    
    if (filters.hazardType) {
      reports = reports.filter(r => r.hazard_type === filters.hazardType);
    }
    
    // Simple pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const offset = (page - 1) * limit;
    
    const paginatedReports = reports.slice(offset, offset + limit);
    
    return {
      data: paginatedReports,
      count: reports.length,
      page,
      limit
    };
  }

  async updateReport(reportId, updates, userId = null, isAuthority = false) {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error('Report not found');
    }
    
    // Simple access control
    if (!isAuthority && userId && report.user_id !== userId) {
      throw new Error('Access denied');
    }
    
    const updatedReport = {
      ...report,
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    this.reports.set(reportId, updatedReport);
    return updatedReport;
  }

  async deleteReport(reportId, userId) {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error('Report not found');
    }
    
    if (report.user_id !== userId) {
      throw new Error('Access denied');
    }
    
    this.reports.delete(reportId);
    return report;
  }

  // Mock file operations
  async uploadFile(bucket, path, file, options = {}) {
    return {
      path: `mock/${bucket}/${path}`,
      fullPath: `mock/${bucket}/${path}`
    };
  }

  getPublicUrl(bucket, path) {
    return `https://mock-storage.com/${bucket}/${path}`;
  }

  async deleteFile(bucket, path) {
    return { success: true };
  }

  // Mock push token operations
  async savePushToken(userId, token, platform) {
    return {
      user_id: userId,
      token,
      platform,
      created_at: new Date().toISOString()
    };
  }

  async getPushTokens(userId) {
    return []; // Empty for mock
  }

  async deletePushToken(token) {
    return { success: true };
  }

  // Mock statistics
  async getReportStatistics(filters = {}) {
    return [
      {
        total_reports: this.reports.size,
        pending_reports: Array.from(this.reports.values()).filter(r => r.status === 'pending').length,
        in_progress_reports: Array.from(this.reports.values()).filter(r => r.status === 'in_progress').length,
        resolved_reports: Array.from(this.reports.values()).filter(r => r.status === 'resolved').length,
        rejected_reports: Array.from(this.reports.values()).filter(r => r.status === 'rejected').length,
        hazard_type: null,
        report_date: new Date().toISOString().split('T')[0]
      }
    ];
  }

  async getReportStatusHistory(reportId) {
    return []; // Empty for mock
  }
}

module.exports = new MockSupabaseService();
