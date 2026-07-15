-- RPC transacional: salva contrato + sincroniza comissões em UMA operação atômica.
-- Se qualquer passo falhar, TUDO é revertido — elimina o estado "contrato salvo
-- com comissões pela metade" que existia com as chamadas separadas do frontend.
--
-- Segurança:
--  * SECURITY INVOKER: as políticas de RLS continuam valendo dentro da função.
--  * user_id vem SEMPRE de auth.uid(). Qualquer user_id enviado pelo navegador
--    é ignorado. Updates/deletes exigem que a linha pertença a auth.uid().

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

  -- ---------- Contrato: update se veio id, insert caso contrário ----------
  IF p_contrato ? 'id' AND NULLIF(p_contrato->>'id', '') IS NOT NULL THEN
    v_contrato_id := (p_contrato->>'id')::uuid;

    UPDATE public.contratos SET
      cliente            = p_contrato->>'cliente',
      tipo               = (p_contrato->>'tipo')::public.tipo_contrato,
      status             = (p_contrato->>'status')::public.status_contrato,
      operadora_id       = NULLIF(p_contrato->>'operadora_id', '')::uuid,
      canal_id           = NULLIF(p_contrato->>'canal_id', '')::uuid,
      categoria_id       = NULLIF(p_contrato->>'categoria_id', '')::uuid,
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
    )
    RETURNING id INTO v_contrato_id;
  END IF;

  -- ---------- Remoção de parcelas (somente as do próprio usuário) ----------
  IF array_length(p_remover_comissoes, 1) IS NOT NULL THEN
    DELETE FROM public.comissoes
    WHERE id = ANY(p_remover_comissoes)
      AND user_id = v_uid
      AND contrato_id = v_contrato_id;
  END IF;

  -- ---------- Upsert das parcelas ----------
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
        pago           = (NULLIF(v_item->>'data_pagamento', '') IS NOT NULL)
      WHERE id = v_comissao_id
        AND user_id = v_uid
        AND contrato_id = v_contrato_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Parcela % não encontrada ou sem permissão', v_comissao_id;
      END IF;
    ELSE
      INSERT INTO public.comissoes (
        user_id, contrato_id, parcela, tipo, mes_previsto, valor, data_pagamento, pago
      ) VALUES (
        v_uid,
        v_contrato_id,
        COALESCE((v_item->>'parcela')::int, 1),
        COALESCE((v_item->>'tipo')::public.tipo_comissao, 'Bancaria'),
        (v_item->>'mes_previsto')::date,
        COALESCE((v_item->>'valor')::numeric, 0),
        NULLIF(v_item->>'data_pagamento', '')::date,
        (NULLIF(v_item->>'data_pagamento', '') IS NOT NULL)
      );
    END IF;
  END LOOP;

  RETURN v_contrato_id;
END;
$$;

-- Só usuários autenticados podem chamar.
REVOKE ALL ON FUNCTION public.save_contrato_com_comissoes(jsonb, jsonb, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.save_contrato_com_comissoes(jsonb, jsonb, uuid[]) TO authenticated;
