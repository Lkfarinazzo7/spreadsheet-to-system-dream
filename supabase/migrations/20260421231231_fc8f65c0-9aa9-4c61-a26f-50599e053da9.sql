
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile + seed default lookups on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));

  INSERT INTO public.operadoras (user_id, nome) VALUES
    (NEW.id, 'Amil'), (NEW.id, 'Bradesco'), (NEW.id, 'Porto Seguro'),
    (NEW.id, 'Assim Saúde'), (NEW.id, 'MedSenior'), (NEW.id, 'SulAmérica');

  INSERT INTO public.canais_venda (user_id, nome) VALUES
    (NEW.id, 'Cliente Antigo'), (NEW.id, 'Indicação'),
    (NEW.id, 'Prospecção Outbound'), (NEW.id, 'UFRJ'), (NEW.id, 'Advogados');

  INSERT INTO public.categorias_plano (user_id, nome) VALUES
    (NEW.id, 'Saúde'), (NEW.id, 'Dental'), (NEW.id, 'Saúde + Dental');

  RETURN NEW;
END;
$$;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- LOOKUP TABLES
CREATE TABLE public.operadoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);
ALTER TABLE public.operadoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own operadoras" ON public.operadoras FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.canais_venda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);
ALTER TABLE public.canais_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own canais" ON public.canais_venda FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.categorias_plano (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);
ALTER TABLE public.categorias_plano ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categorias" ON public.categorias_plano FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CONTRATOS
CREATE TYPE public.tipo_contrato AS ENUM ('PJ', 'PF', 'Adesao');
CREATE TYPE public.status_contrato AS ENUM ('Ativo', 'Cancelado', 'Pendente');

CREATE TABLE public.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_proposta TEXT,
  cliente TEXT NOT NULL,
  tipo public.tipo_contrato NOT NULL DEFAULT 'PF',
  operadora_id UUID REFERENCES public.operadoras(id) ON DELETE SET NULL,
  canal_id UUID REFERENCES public.canais_venda(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.categorias_plano(id) ON DELETE SET NULL,
  valor_mensal NUMERIC(12,2) NOT NULL DEFAULT 0,
  proporcao_comissao NUMERIC(6,2) NOT NULL DEFAULT 0,
  data_vigencia DATE,
  status public.status_contrato NOT NULL DEFAULT 'Ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contratos" ON public.contratos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER contratos_updated_at BEFORE UPDATE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_contratos_user ON public.contratos(user_id);
CREATE INDEX idx_contratos_vigencia ON public.contratos(data_vigencia);

-- COMISSOES
CREATE TYPE public.tipo_comissao AS ENUM ('Bancaria', 'Vida', 'Adesao');

CREATE TABLE public.comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  parcela INTEGER NOT NULL DEFAULT 1,
  tipo public.tipo_comissao NOT NULL DEFAULT 'Bancaria',
  mes_previsto DATE NOT NULL,
  data_pagamento DATE,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  pago BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own comissoes" ON public.comissoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER comissoes_updated_at BEFORE UPDATE ON public.comissoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_comissoes_user ON public.comissoes(user_id);
CREATE INDEX idx_comissoes_contrato ON public.comissoes(contrato_id);
CREATE INDEX idx_comissoes_mes ON public.comissoes(mes_previsto);

-- DESPESAS
CREATE TABLE public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  categoria TEXT,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  pago BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own despesas" ON public.despesas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER despesas_updated_at BEFORE UPDATE ON public.despesas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_despesas_user ON public.despesas(user_id);

-- TRIGGER on auth.users (after lookups exist)
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
