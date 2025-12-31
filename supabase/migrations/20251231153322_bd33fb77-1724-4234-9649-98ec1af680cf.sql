-- Create user_reports table for reporting users
CREATE TABLE public.user_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reporter_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_message_id BIGINT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by_telegram_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service role can manage user reports"
ON public.user_reports
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own reports"
ON public.user_reports
FOR SELECT
USING (reporter_profile_id IN (
  SELECT id FROM profiles WHERE telegram_id IS NOT NULL
));