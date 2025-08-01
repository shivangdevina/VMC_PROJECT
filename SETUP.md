# 🚀 Civic Hazard Reporting App - Complete Setup Guide

This guide will walk you through setting up the complete AI-powered Civic Hazard Reporting App from scratch.

## 📋 Prerequisites

- **Node.js** (v18+)
- **Python** (3.8+)
- **npm** or **yarn**
- **Git**
- **Supabase Account** (free tier available)
- **Expo CLI** (`npm install -g @expo/cli`)

## 🏗️ Project Structure Overview

```
civic-hazard-app/
├── mobile-app/          # React Native Expo app
├── backend/             # Node.js + Express API
├── ml-api/              # FastAPI + YOLOv8 ML service
├── database/            # Supabase schema
└── docs/                # Documentation
```

## 🛠️ Step 1: Database Setup (Supabase)

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign up/login and create a new project
3. Wait for the project to be provisioned
4. Note down your project URL and API keys

### 1.2 Run Database Migrations
1. Go to your Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `database/migrations.sql`
3. Run the migration script
4. Verify tables are created in Table Editor

### 1.3 Configure Storage
1. Go to Storage in Supabase Dashboard
2. Create a new bucket called `reports`
3. Set it to public (for media file access)
4. Configure RLS policies if needed

### 1.4 Enable Row Level Security
All tables should have RLS enabled by the migration script, but verify:
1. Go to Authentication → Policies
2. Ensure policies are active for all tables

## 🗄️ Step 2: Backend API Setup

### 2.1 Install Dependencies
```bash
cd backend
npm install
```

### 2.2 Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration (from your Supabase dashboard)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ML API Configuration
ML_API_URL=http://localhost:8000
ML_API_KEY=your-ml-api-key

# Expo Push Notifications (get from Expo Dashboard)
EXPO_ACCESS_TOKEN=your-expo-access-token

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp,video/mp4,video/quicktime

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:19006,exp://localhost:19000

# Logging
LOG_LEVEL=info
```

### 2.3 Start Backend Server
```bash
npm run dev
```

The server should start on `http://localhost:3000`

## 🤖 Step 3: ML API Setup

### 3.1 Create Python Virtual Environment
```bash
cd ml-api
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 3.2 Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3.3 Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` file:
```env
HOST=0.0.0.0
PORT=8000
ML_API_KEY=your-ml-api-key-here
MODEL_PATH=models/hazard_detection.pt
CONFIDENCE_THRESHOLD=0.5
MAX_BATCH_SIZE=10
```

### 3.4 Start ML API Server
```bash
python app.py
```

The ML API should start on `http://localhost:8000`

**Note:** The first run will download YOLOv8 weights (~6MB). For production, you'd want to train a custom model on road hazard data.

## 📱 Step 4: Mobile App Setup

### 4.1 Create Expo Project
```bash
npx create-expo-app mobile-app --template blank-typescript
cd mobile-app
```

### 4.2 Install Dependencies
```bash
npx expo install expo-camera expo-media-library expo-location @expo/vector-icons
npm install @supabase/supabase-js react-navigation/native react-navigation/stack
npm install @react-navigation/bottom-tabs expo-notifications expo-constants
npm install react-native-screens react-native-safe-area-context
npm install react-hook-form react-native-maps axios
```

### 4.3 Configure Environment
Create `mobile-app/.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

### 4.4 Start Development Server
```bash
npx expo start
```

## 🔧 Step 5: Configuration Details

### 5.1 Supabase Configuration
1. **Auth Settings:**
   - Enable email auth
   - Configure email templates
   - Set JWT expiry times

2. **Storage Settings:**
   - Create `reports` bucket
   - Set appropriate file size limits
   - Configure CORS for your domains

### 5.2 Expo Push Notifications
1. Create an Expo account at [expo.dev](https://expo.dev)
2. Generate an access token
3. Add it to your backend `.env` file

### 5.3 API Keys and Security
- Generate secure API keys for ML API
- Use environment variables for all secrets
- Never commit `.env` files to version control

## 🚀 Step 6: Testing the Setup

### 6.1 Test Backend API
```bash
# Health check
curl http://localhost:3000/health

# Should return:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development",
  "version": "1.0.0"
}
```

### 6.2 Test ML API
```bash
# Health check
curl http://localhost:8000/health

# Should return:
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cpu",
  "timestamp": "2024-01-01 00:00:00 UTC"
}
```

### 6.3 Test Database Connection
1. Try registering a user through the API
2. Check if user appears in Supabase dashboard
3. Test creating a sample report

## 📱 Step 7: Mobile App Features

The mobile app includes:

### For Citizens:
- **Authentication:** Login/Register with role selection
- **Camera Integration:** Take photos/videos of hazards
- **Location Services:** Automatic GPS coordinates
- **Report Creation:** Title, description, media upload
- **AI Detection:** Automatic hazard type detection
- **Report Tracking:** View personal report history
- **Push Notifications:** Status update notifications

### For Authorities:
- **Dashboard:** View all reports with filters
- **Map View:** Geographical report visualization
- **Status Management:** Update report status
- **Analytics:** Report statistics and trends
- **User Management:** View user details
- **Bulk Notifications:** Send area-wide alerts

## 🌐 Step 8: Deployment

### 8.1 Backend Deployment Options
- **Vercel:** Easy deployment for Node.js
- **Railway:** Full-stack deployment
- **Render:** Free tier available
- **AWS/GCP/Azure:** Enterprise options

### 8.2 ML API Deployment Options
- **Railway:** Python support
- **Render:** Free tier with limitations
- **AWS EC2:** Full control
- **Google Cloud Run:** Serverless option

### 8.3 Mobile App Deployment
```bash
# Build for production
npx expo build:android
npx expo build:ios

# Or using EAS Build (recommended)
npm install -g @expo/eas-cli
eas build --platform all
```

## 🔧 Step 9: Production Considerations

### 9.1 Security
- Use HTTPS in production
- Implement rate limiting
- Secure API keys in environment variables
- Enable Supabase RLS policies
- Use proper CORS settings

### 9.2 Performance
- Optimize images before ML processing
- Implement caching for ML predictions
- Use CDN for media files
- Monitor API response times

### 9.3 Monitoring
- Set up logging (Winston, Sentry)
- Monitor ML API performance
- Track mobile app crashes
- Database performance monitoring

## 🆘 Troubleshooting

### Common Issues:

1. **Supabase Connection Errors**
   - Check URL and API keys
   - Verify RLS policies
   - Check network connectivity

2. **ML API Errors**
   - Ensure Python dependencies are installed
   - Check CUDA availability for GPU
   - Verify image formats are supported

3. **Mobile App Issues**
   - Clear Expo cache: `npx expo start -c`
   - Check environment variables
   - Verify camera/location permissions

4. **Push Notification Issues**
   - Verify Expo access token
   - Check device token registration
   - Test with Expo push tool

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Expo Documentation](https://docs.expo.dev)
- [YOLOv8 Documentation](https://docs.ultralytics.com)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [React Native Navigation](https://reactnavigation.org)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Create a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Need Help?** 

- Check the troubleshooting section
- Review the API documentation
- Open an issue on GitHub
- Join our community Discord

🎉 **You're all set!** Your Civic Hazard Reporting App should now be running with:
- ✅ Database with proper schema and RLS
- ✅ Backend API with authentication and file handling
- ✅ ML API with YOLOv8 hazard detection
- ✅ Mobile app foundation ready for development

Start developing the mobile app screens and test the complete workflow!
