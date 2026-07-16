-- Integridade financeira, implantação idempotente e limite de custo da IA.

-- Uma proposta que teve a implantação iniciada guarda o contrato criado. Assim,
-- uma nova tentativa continua no MESMO contrato em vez de criar duplicatas.
ALTER TABLE public.pipeline_contratos
  ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_contrato_unico
  ON public.pipeline_contratos (contrato_id)
  WHERE contrato_id IS NOT NULL;

-- Proteções para novas gravações. NOT VALID preserva eventuais dados históricos
-- que precisam ser saneados separadamente, sem permitir novos valores inválidos.
-- Para registros antigos sem a data real, mantemos a situação de pagamento e
-- usamos a data que o sistema já tratava como referência (prevista/competência).
UPDATE public.comissoes
SET data_pagamento = mes_previsto
WHERE pago = true AND data_pagamento IS NULL;
UPDATE public.comissoes
SET pago = true
WHERE pago = false AND data_pagamento IS NOT NULL;
UPDATE public.despesas
SET data_pagamento = data
WHERE pago = true AND data_pagamento IS NULL;
UPDATE public.despesas
SET pago = true
WHERE pago = false AND data_pagamento IS NOT NULL;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_valor_mensal_nao_negativo CHECK (valor_mensal >= 0) NOT VALID;
ALTER TABLE public.comissoes
  ADD CONSTRAINT comissoes_valor_nao_negativo CHECK (valor >= 0) NOT VALID,
  ADD CONSTRAINT comissoes_parcela_positiva CHECK (parcela >= 1) NOT VALID,
  ADD CONSTRAINT comissoes_pagamento_consistente
    CHECK (pago = (data_pagamento IS NOT NULL)) NOT VALID;
ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_valor_nao_negativo CHECK (valor >= 0) NOT VALID,
  ADD CONSTRAINT despesas_pagamento_consistente
    CHECK (pago = (data_pagamento IS NOT NULL)) NOT VALID;
ALTER TABLE public.pipeline_contratos
  ADD CONSTRAINT pipeline_valor_mensal_nao_negativo CHECK (valor_mensal >= 0) NOT VALID;

-- Salva contrato e parcelas em uma única transação.
CREATE OR REPLACE FUNCTION public.save_contrato_com_comissoes(
  p_contrato jsonb,
  p_comissoes jsonb DEFAULT '[]'::jsonb,
  p_remover_comissoes uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_contrato_id uuid;
  v_item jsonb;
  v_comissao_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF jsonb_typeof(COALESCE(p_comissoes, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Lista de comissões inválida';
  END IF;
  IF COALESCE((p_contrato->>'valor_mensal')::numeric, 0) < 0 THEN
    RAISE EXCEPTION 'O valor mensal não pode ser negativo';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_comissoes, '[]'::jsonb)) item
    WHERE COALESCE((item->>'valor')::numeric, 0) < 0
       OR COALESCE((item->>'parcela')::int, 1) < 1
  ) THEN
    RAISE EXCEPTION 'Comissão com valor ou parcela inválida';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_comissoes, '[]'::jsonb)) item
    GROUP BY COALESCE(item->>'tipo', 'Bancaria'), COALESCE((item->>'parcela')::int, 1)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Há parcelas duplicadas do mesmo tipo';
  END IF;

  IF p_contrato ? 'id' AND NULLIF(p_contrato->>'id', '') IS NOT NULL THEN
    v_contrato_id := (p_contrato->>'id')::uuid;
    UPDATE public.contratos SET
      cliente            = p_contrato->>'cliente',
      tipo               = (p_contrato->>'tipo')::public.tipo_contrato,
      status             = (p_contrato->>'status')::public.status_contrato,
      operadora_id       = NULLIF(p_contrato->>'operadora_id', '')::uuid,
      canal_id           = NULLIF(p_contrato->>'canal_id', '')::uuid,
      categoria_id       = CASE
        WHEN p_contrato ? 'categoria_id' THEN NULLIF(p_contrato->>'categoria_id', '')::uuid
        ELSE categoria_id
      END,
      valor_mensal       = COALESCE((p_contrato->>'valor_mensal')::numeric, 0),
      proporcao_comissao = COALESCE((p_contrato->>'proporcao_comissao')::numeric, 0),
      data_vigencia      = NULLIF(p_contrato->>'data_vigencia', '')::date,
      data_reajuste      = NULLIF(p_contrato->>'data_reajuste', '')::date,
      numero_proposta    = NULLIF(p_contrato->>'numero_proposta', ''),
      observacoes        = NULLIF(p_contrato->>'observacoes', ''),
      dados_proposta     = p_contrato->'dados_proposta'
    WHERE id = v_contrato_id AND user_id = v_uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Contrato não encontrado ou sem permissão';
    END IF;
  ELSE
    INSERT INTO public.contratos (
      user_id, cliente, tipo, status, operadora_id, canal_id, categoria_id,
      valor_mensal, proporcao_comissao, data_vigencia, data_reajuste,
      numero_proposta, observacoes, dados_proposta
    ) VALUES (
      v_uid,
      p_contrato->>'cliente',
      COALESCE((p_contrato->>'tipo')::public.tipo_contrato, 'PF'),
      COALESCE((p_contrato->>'status')::public.status_contrato, 'Ativo'),
      NULLIF(p_contrato->>'operadora_id', '')::uuid,
      NULLIF(p_contrato->>'canal_id', '')::uuid,
      NULLIF(p_contrato->>'categoria_id', '')::uuid,
      COALESCE((p_contrato->>'valor_mensal')::numeric, 0),
      COALESCE((p_contrato->>'proporcao_comissao')::numeric, 0),
      NULLIF(p_contrato->>'data_vigencia', '')::date,
      NULLIF(p_contrato->>'data_reajuste', '')::date,
      NULLIF(p_contrato->>'numero_proposta', ''),
      NULLIF(p_contrato->>'observacoes', ''),
      p_contrato->'dados_proposta'
    ) RETURNING id INTO v_contrato_id;
  END IF;

  IF array_length(p_remover_comissoes, 1) IS NOT NULL THEN
    DELETE FROM public.comissoes
    WHERE id = ANY(p_remover_comissoes)
      AND user_id = v_uid
      AND contrato_id = v_contrato_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_comissoes, '[]'::jsonb))
  LOOP
    v_comissao_id := NULLIF(v_item->>'id', '')::uuid;
    IF v_comissao_id IS NOT NULL THEN
      UPDATE public.comissoes SET
        parcela        = COALESCE((v_item->>'parcela')::int, 1),
        tipo           = COALESCE((v_item->>'tipo')::public.tipo_comissao, 'Bancaria'),
        mes_previsto   = (v_item->>'mes_previsto')::date,
        valor          = COALESCE((v_item->>'valor')::numeric, 0),
        data_pagamento = NULLIF(v_item->>'data_pagamento', '')::date,
        pago           = NULLIF(v_item->>'data_pagamento', '') IS NOT NULL
      WHERE id = v_comissao_id AND user_id = v_uid AND contrato_id = v_contrato_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Parcela % não encontrada ou sem permissão', v_comissao_id;
      END IF;
    ELSE
      INSERT INTO public.comissoes (
        user_id, contrato_id, parcela, tipo, mes_previsto, valor, data_pagamento, pago
      ) VALUES (
        v_uid, v_contrato_id,
        COALESCE((v_item->>'parcela')::int, 1),
        COALESCE((v_item->>'tipo')::public.tipo_comissao, 'Bancaria'),
        (v_item->>'mes_previsto')::date,
        COALESCE((v_item->>'valor')::numeric, 0),
        NULLIF(v_item->>'data_pagamento', '')::date,
        NULLIF(v_item->>'data_pagamento', '') IS NOT NULL
      );
    END IF;
  END LOOP;

  RETURN v_contrato_id;
END;
$$;

-- Converte a proposta de forma idempotente: em nova tentativa reutiliza o
-- contrato que já ficou vinculado à proposta.
CREATE OR REPLACE FUNCTION public.implantar_pipeline_com_contrato(
  p_pipeline_id uuid,
  p_contrato jsonb,
  p_comissoes jsonb DEFAULT '[]'::jsonb,
  p_remover_comissoes uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_contrato_id uuid;
  v_payload jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT contrato_id INTO v_contrato_id
  FROM public.pipeline_contratos
  WHERE id = p_pipeline_id AND user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada ou sem permissão'; END IF;

  v_payload := CASE
    WHEN v_contrato_id IS NULL THEN p_contrato - 'id'
    ELSE p_contrato || jsonb_build_object('id', v_contrato_id)
  END;

  v_contrato_id := public.save_contrato_com_comissoes(
    v_payload, p_comissoes, p_remover_comissoes
  );

  UPDATE public.pipeline_contratos
  SET contrato_id = v_contrato_id
  WHERE id = p_pipeline_id AND user_id = v_uid;

  RETURN v_contrato_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_contrato_com_comissoes(jsonb, jsonb, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.save_contrato_com_comissoes(jsonb, jsonb, uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.implantar_pipeline_com_contrato(uuid, jsonb, jsonb, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.implantar_pipeline_com_contrato(uuid, jsonb, jsonb, uuid[]) TO authenticated;

-- Limite simples por usuário para proteger os créditos da edge function.
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
);
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_pipeline_ai_quota()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  INSERT INTO public.ai_rate_limits(user_id, window_started_at, request_count)
  VALUES (v_uid, now(), 1)
  ON CONFLICT (user_id) DO UPDATE SET
    window_started_at = CASE
      WHEN public.ai_rate_limits.window_started_at <= now() - interval '5 minutes' THEN now()
      ELSE public.ai_rate_limits.window_started_at
    END,
    request_count = CASE
      WHEN public.ai_rate_limits.window_started_at <= now() - interval '5 minutes' THEN 1
      ELSE public.ai_rate_limits.request_count + 1
    END
  RETURNING request_count INTO v_count;

  RETURN v_count <= 20;
END;
$$;

REVOKE ALL ON TABLE public.ai_rate_limits FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_pipeline_ai_quota() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.consume_pipeline_ai_quota() TO authenticated;
