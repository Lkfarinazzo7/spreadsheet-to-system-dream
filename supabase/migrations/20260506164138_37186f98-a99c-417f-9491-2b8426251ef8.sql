ALTER TABLE public.pipeline_contratos
  ADD COLUMN IF NOT EXISTS declinada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_declinio text,
  ADD COLUMN IF NOT EXISTS declinada_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_pipeline_declinada
  ON public.pipeline_contratos (user_id, declinada);