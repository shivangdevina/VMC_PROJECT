-- =====================================================
-- Civic Hazard Reporting App - Complete Database Schema
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CUSTOM TYPES
-- =====================================================

-- User role enumeration
CREATE TYPE user_role AS ENUM ('citizen', 'authority', 'admin');

-- Report status enumeration
CREATE TYPE report_status AS ENUM ('pending', 'in_progress', 'resolved', 'rejected');

-- Hazard type enumeration
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

-- Priority levels
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');

-- =====================================================
-- TABLES
-- =====================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'citizen',
    full_name TEXT,
    phone TEXT,
    profile_image_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    hazard_type hazard_type NOT NULL,
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    media_url TEXT[],
    media_type TEXT[],
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    location_description TEXT,
    status report_status NOT NULL DEFAULT 'pending',
    priority priority_level DEFAULT 'medium',
    assigned_to UUID REFERENCES public.users(id),
    resolution_notes TEXT,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_of UUID REFERENCES public.reports(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report votes table
CREATE TABLE public.report_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vote_type TEXT CHECK (vote_type IN ('upvote', 'downvote')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(report_id, user_id)
);

-- Report status history
CREATE TABLE public.report_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    old_status report_status,
    new_status report_status NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report comments
CREATE TABLE public.report_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    is_official BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Push notification tokens
CREATE TABLE public.push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Spatial index for location queries
CREATE INDEX idx_reports_location ON public.reports USING GIST (ST_Point(longitude, latitude));

-- Standard indexes for reports
CREATE INDEX idx_reports_user_id ON public.reports(user_id);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_hazard_type ON public.reports(hazard_type);
CREATE INDEX idx_reports_priority ON public.reports(priority);
CREATE INDEX idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX idx_reports_assigned_to ON public.reports(assigned_to);

-- Indexes for other tables
CREATE INDEX idx_report_votes_report_id ON public.report_votes(report_id);
CREATE INDEX idx_report_votes_user_id ON public.report_votes(user_id);
CREATE INDEX idx_report_comments_report_id ON public.report_comments(report_id);
CREATE INDEX idx_report_comments_user_id ON public.report_comments(user_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at 
    BEFORE UPDATE ON public.reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_comments_updated_at 
    BEFORE UPDATE ON public.report_comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create status history
CREATE OR REPLACE FUNCTION create_status_history()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.report_status_history (report_id, old_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, COALESCE(NEW.assigned_to, NEW.user_id));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_report_status_history 
    AFTER UPDATE ON public.reports 
    FOR EACH ROW EXECUTE FUNCTION create_status_history();

-- Function to update vote counts
CREATE OR REPLACE FUNCTION update_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.vote_type = 'upvote' THEN
            UPDATE public.reports SET upvotes = upvotes + 1 WHERE id = NEW.report_id;
        ELSIF NEW.vote_type = 'downvote' THEN
            UPDATE public.reports SET downvotes = downvotes + 1 WHERE id = NEW.report_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.vote_type = 'upvote' THEN
            UPDATE public.reports SET upvotes = upvotes - 1 WHERE id = OLD.report_id;
        ELSIF OLD.vote_type = 'downvote' THEN
            UPDATE public.reports SET downvotes = downvotes - 1 WHERE id = OLD.report_id;
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle vote type change
        IF OLD.vote_type = 'upvote' AND NEW.vote_type = 'downvote' THEN
            UPDATE public.reports SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = NEW.report_id;
        ELSIF OLD.vote_type = 'downvote' AND NEW.vote_type = 'upvote' THEN
            UPDATE public.reports SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = NEW.report_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_report_vote_counts
    AFTER INSERT OR UPDATE OR DELETE ON public.report_votes
    FOR EACH ROW EXECUTE FUNCTION update_vote_counts();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all profiles" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Reports policies
CREATE POLICY "Anyone can view reports" ON public.reports
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports" ON public.reports
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Authorities can update assigned reports" ON public.reports
    FOR UPDATE USING (
        auth.uid() = assigned_to OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role IN ('authority', 'admin')
        )
    );

-- Report votes policies
CREATE POLICY "Users can view all votes" ON public.report_votes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own votes" ON public.report_votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes" ON public.report_votes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes" ON public.report_votes
    FOR DELETE USING (auth.uid() = user_id);

-- Report comments policies
CREATE POLICY "Anyone can view comments" ON public.report_comments
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own comments" ON public.report_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.report_comments
    FOR UPDATE USING (auth.uid() = user_id);

-- Push tokens policies
CREATE POLICY "Users can manage own push tokens" ON public.push_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Report status history policies
CREATE POLICY "Anyone can view status history" ON public.report_status_history
    FOR SELECT USING (true);

-- =====================================================
-- VIEWS
-- =====================================================

-- View for report statistics
CREATE OR REPLACE VIEW public.report_stats AS
SELECT 
    hazard_type,
    status,
    COUNT(*) as count,
    AVG(confidence_score) as avg_confidence,
    DATE_TRUNC('day', created_at) as date
FROM public.reports
GROUP BY hazard_type, status, DATE_TRUNC('day', created_at);

-- View for user statistics
CREATE OR REPLACE VIEW public.user_stats AS
SELECT 
    u.id,
    u.full_name,
    u.role,
    COUNT(r.id) as total_reports,
    COUNT(CASE WHEN r.status = 'resolved' THEN 1 END) as resolved_reports,
    AVG(r.confidence_score) as avg_confidence
FROM public.users u
LEFT JOIN public.reports r ON u.id = r.user_id
GROUP BY u.id, u.full_name, u.role;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert sample admin user (you'll need to replace with actual auth user ID)
-- INSERT INTO public.users (id, email, full_name, role, is_verified)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'admin@civichazard.com', 'System Admin', 'admin', true);

-- =====================================================
-- GRANTS AND PERMISSIONS
-- =====================================================

-- Grant usage on schema to authenticated users
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant permissions on sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- STORAGE POLICIES (Run these in the Supabase Dashboard)
-- =====================================================

-- Note: Storage policies need to be created in the Supabase Dashboard
-- or using the dashboard SQL editor after creating the storage bucket.

/*
Storage Bucket Setup Instructions:
1. Go to Storage in Supabase Dashboard
2. Create a new bucket named 'reports'
3. Make it public
4. Set up the following policies:

-- Allow authenticated users to upload files
INSERT policy for authenticated users:
bucket_id = 'reports' AND auth.role() = 'authenticated'

-- Allow public access to view files
SELECT policy for everyone:
bucket_id = 'reports'

-- Allow users to update their own files
UPDATE policy for authenticated users:
bucket_id = 'reports' AND auth.role() = 'authenticated'

-- Allow users to delete their own files
DELETE policy for authenticated users:
bucket_id = 'reports' AND auth.role() = 'authenticated'
*/

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

-- Migration completed successfully!
-- Next steps:
-- 1. Set up storage bucket 'reports' in Supabase Dashboard
-- 2. Configure storage policies
-- 3. Update your .env file with Supabase credentials
-- 4. Test the API endpoints
