-- ================================================
-- Civic Hazard Reporting App - Database Schema
-- ================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- Create custom types
-- ================================================

-- User roles enum
CREATE TYPE user_role AS ENUM ('citizen', 'authority');

-- Report status enum
CREATE TYPE report_status AS ENUM ('pending', 'in_progress', 'resolved', 'rejected');

-- Hazard types enum
CREATE TYPE hazard_type AS ENUM (
    'pothole',
    'damaged_road',
    'fallen_tree',
    'debris',
    'cattle_on_road',
    'flooding',
    'broken_barrier',
    'traffic_light_issue',
    'signage_damage',
    'other'
);

-- ================================================
-- Create tables
-- ================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'citizen',
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    hazard_type hazard_type,
    confidence_score DECIMAL(3,2), -- ML model confidence (0.00-1.00)
    media_url TEXT[], -- Array of media URLs
    media_type TEXT[], -- Array of media types (image/video)
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location_description TEXT,
    status report_status NOT NULL DEFAULT 'pending',
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
    assigned_to UUID REFERENCES public.users(id), -- Authority assigned to handle this
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add spatial index for location queries
CREATE INDEX IF NOT EXISTS idx_reports_location ON public.reports USING GIST (ST_Point(longitude, latitude));

-- Regular indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_hazard_type ON public.reports(hazard_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_assigned_to ON public.reports(assigned_to);

-- Report status history table
CREATE TABLE IF NOT EXISTS public.report_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    old_status report_status,
    new_status report_status NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Push notification tokens table
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL, -- 'ios' or 'android'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- Create functions and triggers
-- ================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create report status history
CREATE OR REPLACE FUNCTION create_status_history()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.report_status_history (report_id, old_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, NEW.assigned_to);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for status history
CREATE TRIGGER create_report_status_history AFTER UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION create_status_history();

-- ================================================
-- Row Level Security (RLS) Policies
-- ================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Authorities can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'authority'
        )
    );

-- Reports table policies
CREATE POLICY "Citizens can view own reports" ON public.reports
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'authority'
        )
    );

CREATE POLICY "Citizens can insert own reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Citizens can update own reports" ON public.reports
    FOR UPDATE USING (
        auth.uid() = user_id AND status = 'pending'
    );

CREATE POLICY "Authorities can view all reports" ON public.reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'authority'
        )
    );

CREATE POLICY "Authorities can update report status" ON public.reports
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'authority'
        )
    );

-- Report status history policies
CREATE POLICY "Users can view status history of accessible reports" ON public.report_status_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.id = report_id AND (
                r.user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.users u 
                    WHERE u.id = auth.uid() AND u.role = 'authority'
                )
            )
        )
    );

-- Push tokens policies
CREATE POLICY "Users can manage own push tokens" ON public.push_tokens
    FOR ALL USING (auth.uid() = user_id);

-- ================================================
-- Create views for common queries
-- ================================================

-- View for reports with user details
CREATE VIEW public.reports_with_users AS
SELECT 
    r.*,
    u.full_name as reporter_name,
    u.email as reporter_email,
    u.phone as reporter_phone,
    au.full_name as assigned_to_name,
    au.email as assigned_to_email
FROM public.reports r
JOIN public.users u ON r.user_id = u.id
LEFT JOIN public.users au ON r.assigned_to = au.id;

-- View for report statistics
CREATE VIEW public.report_statistics AS
SELECT 
    COUNT(*) as total_reports,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_reports,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_reports,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_reports,
    hazard_type,
    DATE_TRUNC('day', created_at) as report_date
FROM public.reports
GROUP BY hazard_type, DATE_TRUNC('day', created_at);

-- ================================================
-- Insert sample data (for testing)
-- ================================================

-- Sample authority user (you'll need to create this through Supabase Auth first)
-- INSERT INTO public.users (id, email, role, full_name, phone) VALUES
-- ('auth-user-id-here', 'admin@city.gov', 'authority', 'City Administrator', '+1234567890');

-- Sample citizen user
-- INSERT INTO public.users (id, email, role, full_name, phone) VALUES
-- ('auth-user-id-here', 'citizen@email.com', 'citizen', 'John Citizen', '+1234567891');

-- ================================================
-- Functions for spatial queries
-- ================================================

-- Function to find reports within a radius (in meters)
CREATE OR REPLACE FUNCTION get_reports_within_radius(
    center_lat DECIMAL(10, 8),
    center_lng DECIMAL(11, 8),
    radius_meters INTEGER DEFAULT 1000
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    hazard_type hazard_type,
    status report_status,
    distance_meters DOUBLE PRECISION,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.title,
        r.hazard_type,
        r.status,
        ST_Distance(
            ST_Transform(ST_GeogFromText('POINT(' || center_lng || ' ' || center_lat || ')'), 3857),
            ST_Transform(ST_GeogFromText('POINT(' || r.longitude || ' ' || r.latitude || ')'), 3857)
        ) as distance_meters,
        r.latitude,
        r.longitude,
        r.created_at
    FROM public.reports r
    WHERE ST_DWithin(
        ST_GeogFromText('POINT(' || center_lng || ' ' || center_lat || ')'),
        ST_GeogFromText('POINT(' || r.longitude || ' ' || r.latitude || ')'),
        radius_meters
    )
    ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
