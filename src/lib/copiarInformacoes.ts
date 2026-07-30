import { formatCurrency, formatDate, getAge } from "@/lib/format";
import type { DadosProposta } from "@/components/pipeline/PipelineForm";

export type CopiavelValues = {
  cliente: string;
  numero_proposta?: string | null;
  tipo?: string | null;
  valor_mensal?: number | null;
  data_vigencia?: string | null;
  data_reajuste?: string | null;
  data_revisao?: string | null;
  etapa?: string | null;
  status?: string | null;
  observacoes?: string | null;
  dados_proposta?: DadosProposta | null;
};

const has = (v: unknown) => v != null && String(v).trim() !== "" && String(v) !== "—";

const join = (parts: (string | null | undefined)[]) =>
  parts.filter((p) => p && p.trim()).join(" | ");

/** Monta um texto legível com todas as informações do cliente. */
export function buildInfoTexto(
  v: CopiavelValues,
  operadoraNome?: string | null,
  canalNome?: string | null,
): string {
  const dp = v.dados_proposta ?? {};
  const lines: string[] = [];

  lines.push(`CLIENTE: ${v.cliente || "—"}`);
  if (has(v.numero_proposta)) lines.push(`Nº da proposta: ${v.numero_proposta}`);

  const linha2 = join([
    has(v.tipo) ? `Tipo: ${v.tipo}` : null,
    has(operadoraNome) ? `Operadora: ${operadoraNome}` : null,
    has(canalNome) ? `Canal: ${canalNome}` : null,
  ]);
  if (linha2) lines.push(linha2);

  const linha3 = join([
    has(v.etapa) ? `Etapa: ${v.etapa}` : null,
    has(v.status) ? `Status: ${v.status}` : null,
  ]);
  if (linha3) lines.push(linha3);

  if (has(dp.cnpj_cpf)) lines.push(`CNPJ/CPF: ${dp.cnpj_cpf}`);
  if (has(dp.categoria)) lines.push(`Categoria: ${dp.categoria}`);
  if (v.valor_mensal != null) lines.push(`Valor mensal: ${formatCurrency(v.valor_mensal)}`);

  const datas = join([
    has(v.data_vigencia) ? `Vigência: ${formatDate(v.data_vigencia)}` : null,
    has(v.data_reajuste ?? dp.data_reajuste)
      ? `Reajuste: ${formatDate(v.data_reajuste ?? dp.data_reajuste)}`
      : null,
    has(v.data_revisao) ? `Próxima revisão: ${formatDate(v.data_revisao)}` : null,
  ]);
  if (datas) lines.push(datas);

  const plano = join([
    has(dp.acomodacao) ? `Acomodação: ${dp.acomodacao}` : null,
    has(dp.coparticipacao) ? `Coparticipação: ${dp.coparticipacao}` : null,
    dp.vidas ? `Vidas: ${dp.vidas}` : null,
  ]);
  if (plano) lines.push(plano);

  if (has(dp.endereco_empresa)) lines.push(`Endereço da empresa: ${dp.endereco_empresa}`);

  const titulares = dp.titulares ?? [];
  if (titulares.length) {
    lines.push("");
    lines.push("TITULARES");
    titulares.forEach((t, i) => {
      const idade = getAge(t.data_nascimento);
      const head = join([
        t.nome?.trim() || "(sem nome)",
        has(t.cpf) ? `CPF ${t.cpf}` : null,
        has(t.data_nascimento)
          ? `Nasc. ${formatDate(t.data_nascimento)}${idade != null ? ` (${idade} anos)` : ""}`
          : null,
        has(t.telefone) ? `Tel ${t.telefone}` : null,
        has(t.email) ? `E-mail ${t.email}` : null,
      ]);
      lines.push(`${i + 1}. ${head}`);
      if (has(t.endereco)) lines.push(`   Endereço: ${t.endereco}`);
      if (has(t.plano_anterior)) lines.push(`   Plano anterior: ${t.plano_anterior}`);
      const deps = t.dependentes ?? [];
      deps.forEach((d) => {
        const dIdade = getAge(d.data_nascimento);
        const dep = join([
          d.nome?.trim() || "(sem nome)",
          has(d.parentesco) ? `${d.parentesco}` : null,
          has(d.cpf) ? `CPF ${d.cpf}` : null,
          has(d.data_nascimento)
            ? `Nasc. ${formatDate(d.data_nascimento)}${dIdade != null ? ` (${dIdade} anos)` : ""}`
            : null,
          has(d.plano_anterior) ? `Plano anterior: ${d.plano_anterior}` : null,
        ]);
        lines.push(`   - Dependente: ${dep}`);
      });
    });
  }

  if (has(v.observacoes)) {
    lines.push("");
    lines.push("OBSERVAÇÕES");
    lines.push(String(v.observacoes).trim());
  }

  return lines.join("\n");
}

/** Copia texto para a área de transferência, com fallback para navegadores/contextos sem permissão. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // cai no fallback abaixo
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
