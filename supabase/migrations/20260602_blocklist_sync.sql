-- Cross-device blocklist sync: one blob per user
CREATE TABLE public.blocklist_selections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  selection_blob TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blocklist_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blocklist"
  ON public.blocklist_selections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
