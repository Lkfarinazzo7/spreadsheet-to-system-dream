-- 1. Cria novo tipo enum com a etapa unificada
CREATE TYPE public.etapa_pipeline_new AS ENUM (
  'Montagem de contrato',
  'Assinatura / Declaração de saúde',
  'Entrevista médica',
  'Em análise',
  'Pendências',
  'Aguardando vigência',
  'Implantado'
);

-- 2. Migra a coluna mapeando os valores antigos para os novos
ALTER TABLE public.pipeline_contratos
  ALTER COLUMN etapa DROP DEFAULT,
  ALTER COLUMN etapa TYPE public.etapa_pipeline_new
    USING (
      CASE etapa::text
        WHEN 'Enviado para assinatura' THEN 'Assinatura / Declaração de saúde'
        WHEN 'Preenchimento da declaração de saúde' THEN 'Assinatura / Declaração de saúde'
        ELSE etapa::text
      END
    )::public.etapa_pipeline_new,
  ALTER COLUMN etapa SET DEFAULT 'Montagem de contrato'::public.etapa_pipeline_new;

-- 3. Remove o tipo antigo e renomeia o novo
DROP TYPE public.etapa_pipeline;
ALTER TYPE public.etapa_pipeline_new RENAME TO etapa_pipeline;