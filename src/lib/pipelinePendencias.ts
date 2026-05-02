import type { PipelineItem } from "@/components/pipeline/PipelineCard";

export function getPendencias(item: PipelineItem & { operadora_id?: string | null; canal_id?: string | null }): string[] {
  const out: string[] = [];
  const dp: any = (item as any).dados_proposta ?? {};

  if (!item.numero_proposta) out.push("Nº proposta");
  if (!(item as any).operadora_id) out.push("Operadora");
  if (!(item as any).canal_id) out.push("Canal");
  if (!Number(item.valor_mensal)) out.push("Valor mensal");
  if (!item.data_vigencia) out.push("Data vigência");
  if (!dp.cnpj_cpf) out.push(item.tipo === "PJ" ? "CNPJ" : "CPF");
  if (!Number(dp.vidas)) out.push("Vidas");
  if (!dp.acomodacao) out.push("Acomodação");
  if (!dp.coparticipacao) out.push("Coparticipação");
  if (item.tipo === "PJ" && !dp.endereco_empresa) out.push("Endereço empresa");

  const titulares = Array.isArray(dp.titulares) ? dp.titulares : [];
  titulares.forEach((t: any, i: number) => {
    if (!t?.nome || !t?.cpf) out.push(`Titular ${i + 1} incompleto`);
  });

  return out;
}