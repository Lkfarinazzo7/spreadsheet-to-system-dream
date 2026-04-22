-- 1. Adicionar coluna data_reajuste em contratos
ALTER TABLE public.contratos
ADD COLUMN IF NOT EXISTS data_reajuste date;

-- 2. Criar enum de etapas do pipeline
DO $$ BEGIN
  CREATE TYPE public.etapa_pipeline AS ENUM (
    'Montagem de contrato',
    'Enviado para assinatura',
    'Preenchimento da declaração de saúde',
    'Entrevista médica',
    'Em análise',
    'Pendências',
    'Aguardando vigência',
    'Implantado'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Criar tabela pipeline_contratos
CREATE TABLE IF NOT EXISTS public.pipeline_contratos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  cliente text NOT NULL,
  numero_proposta text,
  tipo public.tipo_contrato NOT NULL DEFAULT 'PF',
  operadora_id uuid,
  canal_id uuid,
  valor_mensal numeric NOT NULL DEFAULT 0,
  data_vigencia date,
  etapa public.etapa_pipeline NOT NULL DEFAULT 'Montagem de contrato',
  posicao integer NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own pipeline"
  ON public.pipeline_contratos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_pipeline
  BEFORE UPDATE ON public.pipeline_contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_pipeline_user_etapa
  ON public.pipeline_contratos(user_id, etapa, posicao);