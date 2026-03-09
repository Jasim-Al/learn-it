-- ============================================================
-- Migration: Add chapter image_url column + Supabase Storage
-- ============================================================

-- 1. Add thumbnail_url column to courses table
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT NULL;

-- 2. Add image_url column to chapters table
ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- 3. Create storage buckets for images (public)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('chapter-images', 'chapter-images', true),
         ('course-thumbnails', 'course-thumbnails', true)
  ON CONFLICT (id) DO NOTHING;

-- 4. RLS policy: anyone can read images (public bucket)
CREATE POLICY "Public read images"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('chapter-images', 'course-thumbnails'));

-- 5. RLS policy: authenticated users can upload images
CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('chapter-images', 'course-thumbnails'));

-- 6. RLS policy: authenticated users can update/replace their images
CREATE POLICY "Authenticated users can update images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('chapter-images', 'course-thumbnails'));
