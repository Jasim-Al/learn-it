-- Create courses table
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    model TEXT NOT NULL, -- e.g., 'gemini-2.5-flash', 'gpt-4o-mini'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create chapters table
CREATE TABLE IF NOT EXISTS public.chapters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT, -- Will hold the markdown script
    type TEXT DEFAULT 'podcast', -- 'podcast', 'study_material', etc.
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options_json JSONB NOT NULL, -- e.g., ["A", "B", "C", "D"]
    correct_answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create exams table
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    questions_json JSONB NOT NULL, -- array of quiz-like question objects
    score INTEGER DEFAULT NULL,
    user_answers JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

-- Create Policies for 'courses'
CREATE POLICY "Users can view their own courses" ON public.courses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own courses" ON public.courses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own courses" ON public.courses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own courses" ON public.courses
    FOR DELETE USING (auth.uid() = user_id);

-- Create Policies for 'chapters' (access driven by course ownership)
CREATE POLICY "Users can view chapters of their courses" ON public.chapters
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = chapters.course_id AND courses.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert chapters into their courses" ON public.chapters
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = chapters.course_id AND courses.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update chapters of their courses" ON public.chapters
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = chapters.course_id AND courses.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete chapters of their courses" ON public.chapters
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = chapters.course_id AND courses.user_id = auth.uid()
        )
    );

-- Create Policies for 'quizzes' (access driven by chapter -> course ownership)
CREATE POLICY "Users can view quizzes of their chapters" ON public.quizzes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chapters
            JOIN public.courses ON chapters.course_id = courses.id
            WHERE chapters.id = quizzes.chapter_id AND courses.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert quizzes into their chapters" ON public.quizzes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chapters
            JOIN public.courses ON chapters.course_id = courses.id
            WHERE chapters.id = quizzes.chapter_id AND courses.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update quizzes of their chapters" ON public.quizzes
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.chapters
            JOIN public.courses ON chapters.course_id = courses.id
            WHERE chapters.id = quizzes.chapter_id AND courses.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete quizzes of their chapters" ON public.quizzes
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.chapters
            JOIN public.courses ON chapters.course_id = courses.id
            WHERE chapters.id = quizzes.chapter_id AND courses.user_id = auth.uid()
        )
    );

-- Create Policies for 'exams' (access driven by course ownership)
CREATE POLICY "Users can view exams of their courses" ON public.exams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = exams.course_id AND courses.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert exams into their courses" ON public.exams
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = exams.course_id AND courses.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update exams of their courses" ON public.exams
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = exams.course_id AND courses.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete exams of their courses" ON public.exams
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = exams.course_id AND courses.user_id = auth.uid()
        )
    );
