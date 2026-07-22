import type { ComissaoLine } from "@/components/contratos/ContratoForm";
import { localIso } from "@/lib/format";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Percentuais padrão de comissão bancária por parcela, por operadora.
export const COMISSAO_PRESETS: Record<string, number[]> = {
  "amil": [100, 100, 80],
  "assim saude": [100, 100, 80],
  "sulamerica": [100, 100, 80],
  "porto seguro": [100, 100, 80],
  "klini saude": [100, 100, 80],
  "bradesco": [100, 100, 100, 50],
  "leve saude": [100, 80],
  "medsenior": [100, 70],
  "prevent senior": [100, 40, 40],
};

export function getPresetPercentuais(operadoraNome?: string | null): number[] | null {
  if (!operadoraNome) return null;
  const key = normalize(operadoraNome);
  return COMISSAO_PRESETS[key] ?? null;
}

export function presetComissoes(operadoraNome: string | null | undefined, valorMensal: number): ComissaoLine[] | null {
  const pcts = getPresetPercentuais(operadoraNome);
  if (!pcts) return null;
  const mensal = Number(valorMensal) || 0;
  const iso = localIso();
  return pcts.map((pct, i) => ({
    tipo: "Bancaria",
    parcela: i + 1,
    percentual: pct,
    valor: Number(((mensal * pct) / 100).toFixed(2)),
    mes_previsto: iso,
    data_pagamento: null,
  }));
}

// Considera "default" (intocado) se todas as linhas não têm id nem valor nem percentual.
export function isDefaultComissoes(list: ComissaoLine[]): boolean {
  return list.every((c) => !c.id && (Number(c.valor) || 0) === 0 && (c.percentual == null || Number.isNaN(c.percentual)));
}