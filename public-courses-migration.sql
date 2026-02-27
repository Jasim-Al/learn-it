-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their own courses" ON public.courses;
DROP POLICY IF EXISTS "Users can view chapters of their courses" ON public.chapters;
DROP POLICY IF EXISTS "Users can view quizzes of their chapters" ON public.quizzes;
DROP POLICY IF EXISTS "Users can view exams of their courses" ON public.exams;

-- Create new policies to allow anyone (public) to view these resources
CREATE POLICY "Anyone can view courses" ON public.courses
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view chapters" ON public.chapters
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view quizzes" ON public.quizzes
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view exams" ON public.exams
    FOR SELECT USING (true);

-- Note: The INSERT, UPDATE, and DELETE policies remain unchanged to protect data
