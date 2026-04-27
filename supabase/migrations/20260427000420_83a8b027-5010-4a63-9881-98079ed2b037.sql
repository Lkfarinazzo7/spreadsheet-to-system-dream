ALTER TABLE public.pipeline_contratos
  ADD CONSTRAINT pipeline_contratos_operadora_id_fkey
  FOREIGN KEY (operadora_id) REFERENCES public.operadoras(id) ON DELETE SET NULL;

ALTER TABLE public.pipeline_contratos
  ADD CONSTRAINT pipeline_contratos_canal_id_fkey
  FOREIGN KEY (canal_id) REFERENCES public.canais_venda(id) ON DELETE SET NULL;

ALTER TABLE public.pipeline_contratos
  ADD CONSTRAINT pipeline_contratos_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;