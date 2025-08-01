# 🚨 Civic Hazard Reporting App

An AI-powered mobile app for citizens to report road hazards with automatic hazard detection using YOLOv8 ML model.

## 🏗️ Project Structure

```
civic-hazard-app/
├── mobile-app/          # React Native Expo frontend
├── backend/             # Node.js + Express API server
├── ml-api/              # FastAPI ML inference server
├── database/            # Supabase schema and migrations
├── docs/                # Documentation
└── README.md
```

## 🚀 Features

### 👥 For Citizens
- 📸 Upload photos/videos of road hazards
- 🤖 Automatic hazard detection using AI
- 📍 Automatic geolocation capture
- 📱 Real-time status updates via push notifications
- 📊 View personal report history

### 🏛️ For Authorities
- 📋 Dashboard to view all reports
- 🔍 Filter by location, status, hazard type
- ✅ Update report status (pending → in progress → resolved)
- 📊 Analytics and reporting tools

## 🛠️ Tech Stack

- **Frontend:** React Native (Expo)
- **Backend:** Node.js + Express
- **ML API:** FastAPI + YOLOv8
- **Database:** Supabase (PostgreSQL + PostGIS)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Notifications:** Expo Push Notifications

## 📦 Quick Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd civic-hazard-app
   ```

2. **Set up Supabase:**
   - Create a new Supabase project
   - Run the database migrations in `database/migrations.sql`
   - Configure Row Level Security (RLS)

3. **Backend setup:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure your environment variables
   npm run dev
   ```

4. **ML API setup:**
   ```bash
   cd ml-api
   pip install -r requirements.txt
   python app.py
   ```

5. **Mobile app setup:**
   ```bash
   cd mobile-app
   npm install
   npx expo start
   ```

## 🔧 Environment Variables

See individual `.env.example` files in each directory for required configuration.

## 📚 Documentation

- [API Documentation](docs/api.md)
- [Database Schema](docs/database.md)
- [Deployment Guide](docs/deployment.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see LICENSE file for details
