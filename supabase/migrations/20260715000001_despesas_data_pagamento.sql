-- Adiciona data real de pagamento em despesas, permitindo separar
-- regime de competência (data prevista) de regime de caixa (data_pagamento).
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS data_pagamento DATE;

-- Backfill: despesas já marcadas como pagas assumem a própria data prevista
-- como data de pagamento (melhor aproximação disponível para o histórico).
UPDATE public.despesas
SET data_pagamento = data
WHERE pago = true AND data_pagamento IS NULL;

COMMENT ON COLUMN public.despesas.data_pagamento IS
  'Data em que a despesa foi efetivamente paga (regime de caixa). NULL enquanto em aberto.';
