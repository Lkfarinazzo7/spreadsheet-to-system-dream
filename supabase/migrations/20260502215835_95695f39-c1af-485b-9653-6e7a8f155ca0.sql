-- Add data_revisao to pipeline
ALTER TABLE public.pipeline_contratos ADD COLUMN IF NOT EXISTS data_revisao DATE NULL;

-- Storage bucket for pipeline attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pipeline-anexos', 'pipeline-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects scoped to bucket; first folder = user_id
CREATE POLICY "pipeline-anexos select own"
ON storage.objects FOR SELECT
USING (bucket_id = 'pipeline-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pipeline-anexos insert own"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pipeline-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pipeline-anexos update own"
ON storage.objects FOR UPDATE
USING (bucket_id = 'pipeline-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pipeline-anexos delete own"
ON storage.objects FOR DELETE
USING (bucket_id = 'pipeline-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);
