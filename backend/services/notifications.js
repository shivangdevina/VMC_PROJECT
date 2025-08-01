const { Expo } = require('expo-server-sdk');
const supabaseService = require('./supabase');

class NotificationService {
  constructor() {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true
    });
  }

  async sendPushNotification(userId, title, body, data = {}) {
    try {
      // Get user's push tokens
      const pushTokens = await supabaseService.getPushTokens(userId);
      
      if (!pushTokens || pushTokens.length === 0) {
        console.log(`No push tokens found for user ${userId}`);
        return { success: false, message: 'No push tokens found' };
      }

      const messages = [];
      
      for (const tokenData of pushTokens) {
        // Check if token is valid
        if (!Expo.isExpoPushToken(tokenData.token)) {
          console.error(`Invalid push token: ${tokenData.token}`);
          continue;
        }

        messages.push({
          to: tokenData.token,
          sound: 'default',
          title,
          body,
          data,
          priority: 'high',
          badge: 1
        });
      }

      if (messages.length === 0) {
        console.log('No valid push tokens to send to');
        return { success: false, message: 'No valid push tokens' };
      }

      // Send notifications in chunks
      const chunks = this.expo.chunkPushNotifications(messages);
      const results = [];

      for (const chunk of chunks) {
        try {
          const result = await this.expo.sendPushNotificationsAsync(chunk);
          results.push(...result);
        } catch (error) {
          console.error('Error sending push notification chunk:', error);
        }
      }

      // Handle receipts
      await this.handlePushNotificationReceipts(results);

      return {
        success: true,
        messagesSent: messages.length,
        results
      };
    } catch (error) {
      console.error('Push notification error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handlePushNotificationReceipts(results) {
    const receiptIds = results
      .filter(result => result.status === 'ok')
      .map(result => result.id);

    if (receiptIds.length === 0) return;

    try {
      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
      
      for (const chunk of receiptIdChunks) {
        const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
        
        for (const receiptId in receipts) {
          const receipt = receipts[receiptId];
          
          if (receipt.status === 'error') {
            console.error('Push notification error:', receipt.message);
            
            // Handle specific errors
            if (receipt.details && receipt.details.error) {
              const errorCode = receipt.details.error;
              
              if (errorCode === 'DeviceNotRegistered') {
                // Remove invalid token from database
                // Note: We'd need the token to do this, which isn't available in receipts
                console.log('Device not registered, should remove token');
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling push notification receipts:', error);
    }
  }

  // Send notification when report status changes
  async notifyReportStatusChange(reportId, newStatus, userId) {
    try {
      const statusMessages = {
        'in_progress': {
          title: '🔄 Report Update',
          body: 'Your hazard report is now being processed by authorities.'
        },
        'resolved': {
          title: '✅ Report Resolved',
          body: 'Your hazard report has been resolved. Thank you for reporting!'
        },
        'rejected': {
          title: '❌ Report Update',
          body: 'Your hazard report has been reviewed. Please check the app for details.'
        }
      };

      const message = statusMessages[newStatus];
      if (!message) return;

      const data = {
        type: 'report_status_change',
        reportId,
        newStatus
      };

      return await this.sendPushNotification(userId, message.title, message.body, data);
    } catch (error) {
      console.error('Error sending status change notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to authorities when new report is created
  async notifyAuthoritiesNewReport(report) {
    try {
      // Get all authority users
      const { data: authorities } = await supabaseService.client
        .from('users')
        .select('id')
        .eq('role', 'authority');

      if (!authorities || authorities.length === 0) {
        console.log('No authorities found to notify');
        return;
      }

      const title = '🚨 New Hazard Report';
      const body = `New ${report.hazard_type} reported at ${report.location_description || 'location'}`;
      const data = {
        type: 'new_report',
        reportId: report.id,
        hazardType: report.hazard_type
      };

      const results = [];
      for (const authority of authorities) {
        const result = await this.sendPushNotification(authority.id, title, body, data);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error('Error notifying authorities:', error);
      return { success: false, error: error.message };
    }
  }

  // Send bulk notification to multiple users
  async sendBulkNotification(userIds, title, body, data = {}) {
    try {
      const results = [];
      
      for (const userId of userIds) {
        const result = await this.sendPushNotification(userId, title, body, data);
        results.push({ userId, ...result });
      }

      return {
        success: true,
        results,
        totalSent: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length
      };
    } catch (error) {
      console.error('Bulk notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send emergency notification to all users in an area
  async sendEmergencyNotification(latitude, longitude, radius, title, body) {
    try {
      // Get reports within the radius to find affected users
      const { data: nearbyReports } = await supabaseService.client
        .rpc('get_reports_within_radius', {
          center_lat: latitude,
          center_lng: longitude,
          radius_meters: radius
        });

      const userIds = [...new Set(nearbyReports.map(report => report.user_id))];

      if (userIds.length === 0) {
        return { success: true, message: 'No users in the specified area' };
      }

      const data = {
        type: 'emergency',
        latitude,
        longitude,
        radius
      };

      return await this.sendBulkNotification(userIds, title, body, data);
    } catch (error) {
      console.error('Emergency notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Register a push token for a user
  async registerPushToken(userId, token, platform) {
    try {
      if (!Expo.isExpoPushToken(token)) {
        throw new Error('Invalid push token format');
      }

      await supabaseService.savePushToken(userId, token, platform);
      
      return { success: true, message: 'Push token registered successfully' };
    } catch (error) {
      console.error('Error registering push token:', error);
      return { success: false, error: error.message };
    }
  }

  // Remove a push token
  async removePushToken(token) {
    try {
      await supabaseService.deletePushToken(token);
      return { success: true, message: 'Push token removed successfully' };
    } catch (error) {
      console.error('Error removing push token:', error);
      return { success: false, error: error.message };
    }
  }

  // Test notification (for development)
  async sendTestNotification(userId) {
    const title = '🧪 Test Notification';
    const body = 'This is a test notification from Civic Hazard App';
    const data = { type: 'test' };

    return await this.sendPushNotification(userId, title, body, data);
  }
}

module.exports = new NotificationService();
