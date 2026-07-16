import { isValidIsoDate, parseBRL } from "./format";

export const ETAPAS_VALIDAS = [
  "Montagem de contrato",
  "Assinatura / Declaração de saúde",
  "Entrevista médica",
  "Em análise",
  "Pendências",
  "Aguardando vigência",
  "Implantado",
] as const;

export type EtapaValida = (typeof ETAPAS_VALIDAS)[number];

export type ImportRow = {
  cliente: string;
  numero_proposta: string | null;
  tipo: "PF" | "PJ" | "Adesao";
  operadora_id: string | null;
  canal_id: string | null;
  etapa: EtapaValida;
  valor_mensal: number;
  data_vigencia: string | null;
  observacoes: string | null;
  dados_proposta: Record<string, unknown>;
  _rowIndex: number;
  _warnings: string[];
};

export type ImportError = { row: number; reason: string };

export type ParseResult = {
  valid: ImportRow[];
  errors: ImportError[];
};

const TIPO_MAP: Record<string, "PF" | "PJ" | "Adesao"> = {
  pf: "PF",
  pj: "PJ",
  adesao: "Adesao",
  adesão: "Adesao",
};

const norm = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Parse a date that may be ISO, dd/mm/yyyy or Excel serial number → ISO yyyy-mm-dd or null */
export function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial date (days since 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) {
    const [, d, m, y] = br;
    const yyyy = y.length === 2 ? `20${y}` : y;
    const value = `${yyyy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return isValidIsoDate(value) ? value : null;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    const value = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return isValidIsoDate(value) ? value : null;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const value = d.toISOString().slice(0, 10);
    return isValidIsoDate(value) ? value : null;
  }
  return null;
}

function parseValor(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  // Sem nenhum dígito não há como ser um valor válido
  if (!/\d/.test(s)) return null;
  const n = parseBRL(s);
  return Number.isFinite(n) ? n : null;
}

export function parseImportRows(
  rows: Record<string, unknown>[],
  ctx: {
    operadoras: { id: string; nome: string }[];
    canais: { id: string; nome: string }[];
    defaultEtapa: EtapaValida;
  },
): ParseResult {
  const valid: ImportRow[] = [];
  const errors: ImportError[] = [];

  const opMap = new Map(ctx.operadoras.map((o) => [norm(o.nome), o.id]));
  const canMap = new Map(ctx.canais.map((c) => [norm(c.nome), c.id]));
  const etapaMap = new Map<string, EtapaValida>(
    ETAPAS_VALIDAS.map((e) => [norm(e), e]),
  );
  const seenProposals = new Set<string>();

  rows.forEach((raw, i) => {
    const rowNum = i + 2; // header is row 1
    // Normalize keys
    const r: Record<string, unknown> = {};
    for (const k of Object.keys(raw)) r[norm(k)] = raw[k];

    const cliente = String(r["cliente"] ?? "").trim();
    if (!cliente) {
      errors.push({ row: rowNum, reason: "Cliente em branco" });
      return;
    }

    const valor = parseValor(r["valor_mensal"] ?? r["valor"] ?? r["valor total"]);
    if (valor == null || valor < 0) {
      errors.push({ row: rowNum, reason: "Valor inválido" });
      return;
    }

    const warnings: string[] = [];
    const tipoRaw = norm(r["tipo"] ?? r["tipo contrato"]);
    if (tipoRaw && !TIPO_MAP[tipoRaw]) {
      errors.push({ row: rowNum, reason: `Tipo "${r["tipo"] ?? r["tipo contrato"]}" inválido` });
      return;
    }
    const tipo = TIPO_MAP[tipoRaw] ?? "PF";

    const operadoraNome = String(r["operadora"] ?? "").trim();
    const operadora_id = operadoraNome ? opMap.get(norm(operadoraNome)) ?? null : null;
    if (operadoraNome && !operadora_id) warnings.push(`Operadora "${operadoraNome}" não encontrada`);

    const canalNome = String(r["canal"] ?? "").trim();
    const canal_id = canalNome ? canMap.get(norm(canalNome)) ?? null : null;
    if (canalNome && !canal_id) warnings.push(`Canal "${canalNome}" não encontrado`);

    const etapaRaw = norm(r["etapa"]);
    const etapa = etapaMap.get(etapaRaw) ?? ctx.defaultEtapa;
    if (etapaRaw && !etapaMap.has(etapaRaw))
      warnings.push(`Etapa "${r["etapa"]}" inválida, usando "${ctx.defaultEtapa}"`);

    const data_vigencia = parseDate(r["data_vigencia"] ?? r["vigencia"]);
    const dataRaw = r["data_vigencia"] ?? r["vigencia"];
    if (dataRaw != null && String(dataRaw).trim() && !data_vigencia) {
      errors.push({ row: rowNum, reason: "Data de vigência inválida" });
      return;
    }
    const vidasRaw = r["vidas"];
    const vidas =
      vidasRaw == null || vidasRaw === ""
        ? undefined
        : Number(String(vidasRaw).replace(/\D/g, "")) || undefined;

    const dados_proposta: Record<string, unknown> = {
      cnpj_cpf: String(r["cnpj_cpf"] ?? r["cnpj"] ?? r["cpf"] ?? "").trim() || undefined,
      vidas,
      categoria: String(r["categoria"] ?? "").trim() || undefined,
      acomodacao: String(r["acomodacao"] ?? "").trim() || undefined,
      coparticipacao: String(r["coparticipacao"] ?? "").trim() || undefined,
      endereco_empresa: String(r["endereco"] ?? r["endereço"] ?? "").trim() || undefined,
    };

    const numeroProposta = String(r["numero_proposta"] ?? r["proposta"] ?? "").trim() || null;
    if (numeroProposta) {
      const proposalKey = `${operadora_id ?? "sem-operadora"}:${norm(numeroProposta)}`;
      if (seenProposals.has(proposalKey)) {
        errors.push({ row: rowNum, reason: `Proposta ${numeroProposta} duplicada no arquivo` });
        return;
      }
      seenProposals.add(proposalKey);
    }

    valid.push({
      cliente,
      numero_proposta: numeroProposta,
      tipo,
      operadora_id,
      canal_id,
      etapa,
      valor_mensal: valor,
      data_vigencia,
      observacoes: String(r["observacoes"] ?? r["observações"] ?? "").trim() || null,
      dados_proposta,
      _rowIndex: rowNum,
      _warnings: warnings,
    });
  });

  return { valid, errors };
}

export const TEMPLATE_HEADERS = [
  "cliente",
  "numero_proposta",
  "tipo",
  "operadora",
  "canal",
  "etapa",
  "valor_mensal",
  "data_vigencia",
  "cnpj_cpf",
  "vidas",
  "categoria",
  "acomodacao",
  "coparticipacao",
  "endereco",
  "observacoes",
] as const;

export const TEMPLATE_EXAMPLE: Record<(typeof TEMPLATE_HEADERS)[number], string | number> = {
  cliente: "João da Silva",
  numero_proposta: "12345",
  tipo: "PF",
  operadora: "Amil",
  canal: "Indicação",
  etapa: "Montagem de contrato",
  valor_mensal: "1.234,56",
  data_vigencia: "01/06/2026",
  cnpj_cpf: "000.000.000-00",
  vidas: 2,
  categoria: "Saúde",
  acomodacao: "Apartamento",
  coparticipacao: "Parcial",
  endereco: "Rua Exemplo, 123 — Rio de Janeiro/RJ",
  observacoes: "",
};
