# 🔌 Civic Hazard Reporting API Documentation

Base URL: `http://localhost:3000/api`

## 🔐 Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 📱 Auth Endpoints

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "role": "citizen",  // or "authority"
  "fullName": "John Doe",
  "phone": "+1234567890"
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

## 📊 Reports Endpoints

### Get Reports (with filters)
```http
GET /api/reports?page=1&limit=20&status=pending&hazardType=pothole
Authorization: Bearer <token>

Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 20, max: 100)
- status: pending|in_progress|resolved|rejected
- hazardType: pothole|damaged_road|fallen_tree|debris|cattle_on_road|flooding|broken_barrier|traffic_light_issue|signage_damage|other
- latitude: Filter by location
- longitude: Filter by location  
- radius: Radius in meters (default: 5000)
- startDate: ISO date string
- endDate: ISO date string
- sortBy: created_at|updated_at|status|priority
- sortOrder: asc|desc
```

### Get Single Report
```http
GET /api/reports/:id
Authorization: Bearer <token>
```

### Create Report
```http
POST /api/reports
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- title: "Pothole on Main Street"
- description: "Large pothole causing damage"
- latitude: 40.7128
- longitude: -74.0060
- locationDescription: "Main St near intersection"
- priority: 1  // 1=low, 2=medium, 3=high
- media: File[] (up to 5 images/videos)
```

### Update Report (Citizens - own reports only)
```http
PUT /api/reports/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated title",
  "description": "Updated description",
  "locationDescription": "Updated location",
  "priority": 2
}
```

### Update Report Status (Authorities only)
```http
PATCH /api/reports/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "in_progress",  // pending|in_progress|resolved|rejected
  "assignedTo": "authority-user-id",
  "resolutionNotes": "Work in progress"
}
```

### Delete Report (Citizens - own pending reports only)
```http
DELETE /api/reports/:id
Authorization: Bearer <token>
```

### Get Report Status History
```http
GET /api/reports/:id/history
Authorization: Bearer <token>
```

### Get Report Statistics (Authorities only)
```http
GET /api/reports/statistics?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

## 👥 User Endpoints

### Get Current User Profile
```http
GET /api/users/profile
Authorization: Bearer <token>
```

### Update Profile
```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "Updated Name",
  "phone": "+1234567890"
}
```

### Get All Users (Authorities only)
```http
GET /api/users
Authorization: Bearer <token>
```

### Get User by ID (Authorities only)
```http
GET /api/users/:id
Authorization: Bearer <token>
```

### Get User's Reports (Authorities only)
```http
GET /api/users/:id/reports?page=1&limit=20
Authorization: Bearer <token>
```

## 🔔 Notification Endpoints

### Register Push Token
```http
POST /api/notifications/register-token
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "expo-push-token",
  "platform": "ios"  // or "android"
}
```

### Remove Push Token
```http
DELETE /api/notifications/token/:token
Authorization: Bearer <token>
```

### Send Test Notification
```http
POST /api/notifications/test
Authorization: Bearer <token>
```

### Send Bulk Notification (Authorities only)
```http
POST /api/notifications/bulk
Authorization: Bearer <token>
Content-Type: application/json

{
  "userIds": ["user-id-1", "user-id-2"],
  "title": "Important Update",
  "body": "Please check your reports",
  "data": { "type": "announcement" }
}
```

### Send Emergency Notification (Authorities only)
```http
POST /api/notifications/emergency
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "radius": 5000,
  "title": "Emergency Alert",
  "body": "Road closure due to flooding"
}
```

## 🤖 ML API Endpoints

Base URL: `http://localhost:8000`

### Health Check
```http
GET /health
```

### Get Model Info
```http
GET /info
Authorization: Bearer <ml-api-key>
```

### Predict Hazard (Single Image)
```http
POST /predict
Authorization: Bearer <ml-api-key>
Content-Type: multipart/form-data

Form Data:
- file: Image file
- confidence_threshold: 0.5 (optional)
```

### Predict Hazards (Batch)
```http
POST /predict/batch
Authorization: Bearer <ml-api-key>
Content-Type: multipart/form-data

Form Data:
- files: Multiple image files (max 10)
- confidence_threshold: 0.5 (optional)
```

## 📝 Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400,
    "details": [ /* validation errors if applicable */ ]
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ /* array of items */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

## 🔧 Error Codes

- **200** - Success
- **201** - Created
- **400** - Bad Request (validation errors)
- **401** - Unauthorized (invalid/missing token)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found
- **409** - Conflict (duplicate data)
- **429** - Too Many Requests (rate limited)
- **500** - Internal Server Error

## 🛡️ Rate Limiting

- **Default:** 100 requests per 15 minutes per IP
- **Configurable** via environment variables

## 📁 File Upload Limits

- **Max file size:** 10MB per file
- **Max files:** 5 files per request
- **Allowed types:** 
  - Images: JPEG, PNG, WebP
  - Videos: MP4, QuickTime

## 🔐 Security Features

- JWT-based authentication
- Role-based access control (RLS)
- Rate limiting
- File type validation
- CORS protection
- Helmet security headers

## 📊 Database Schema

### Users Table
```sql
- id: UUID (Primary Key)
- email: TEXT (Unique)
- role: user_role ENUM
- full_name: TEXT
- phone: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Reports Table
```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key)
- title: TEXT
- description: TEXT
- hazard_type: hazard_type ENUM
- confidence_score: DECIMAL(3,2)
- media_url: TEXT[] (Array)
- media_type: TEXT[] (Array)
- latitude: DECIMAL(10,8)
- longitude: DECIMAL(11,8)
- location_description: TEXT
- status: report_status ENUM
- priority: INTEGER
- assigned_to: UUID (Foreign Key)
- resolution_notes: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## 🚀 Getting Started

1. Set up Supabase database with provided schema
2. Configure environment variables
3. Start backend server: `npm run dev`
4. Start ML API: `python app.py`
5. Test endpoints with provided examples

## 📚 Additional Resources

- [Setup Guide](SETUP.md)
- [Supabase Documentation](https://supabase.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
