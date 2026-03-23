-- Donations table for tracking all payments
CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text UNIQUE,
  amount numeric NOT NULL DEFAULT 0,
  donor_name text NOT NULL DEFAULT 'Anonymous',
  user_id uuid REFERENCES auth.users(id),
  email text,
  payment_method text DEFAULT 'card',
  status text NOT NULL DEFAULT 'completed',
  comment text,
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Anyone can view completed donations (for the supporters list)
CREATE POLICY "Anyone can view completed donations" ON public.donations
  FOR SELECT USING (status = 'completed');

-- Service role can insert (from webhook)
CREATE POLICY "Service can insert donations" ON public.donations
  FOR INSERT WITH CHECK (true);

-- Users can update their own donation (to add comment)
CREATE POLICY "Users can update own donations" ON public.donations
  FOR UPDATE USING (
    user_id = auth.uid()
    OR stripe_session_id IS NOT NULL
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_donations_created ON public.donations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_session ON public.donations (stripe_session_id);
