ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS data_pagamento DATE;

UPDATE public.despesas SET data_pagamento = data WHERE pago = true AND data_pagamento IS NULL;

COMMENT ON COLUMN public.despesas.data_pagamento IS 'Data em que a despesa foi efetivamente paga (regime de caixa). NULL enquanto em aberto.';