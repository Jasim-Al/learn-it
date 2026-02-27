-- Create certificates table
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Create Policies for 'certificates'
CREATE POLICY "Users can view their own certificates" ON public.certificates
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own certificates" ON public.certificates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own certificates" ON public.certificates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own certificates" ON public.certificates
    FOR DELETE USING (auth.uid() = user_id);
