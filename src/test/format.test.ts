import { describe, expect, it } from "vitest";
import { formatBRL, localIso, parseBRL } from "@/lib/format";
import { parseImportRows } from "@/lib/pipelineImport";

describe("parseBRL", () => {
  it("formato BR completo: '1.234,56' → 1234.56", () => {
    expect(parseBRL("1.234,56")).toBe(1234.56);
  });

  it("BR sem milhar: '1234,56' → 1234.56", () => {
    expect(parseBRL("1234,56")).toBe(1234.56);
  });

  it("decimal americano: '1234.56' → 1234.56 (NÃO 123456)", () => {
    expect(parseBRL("1234.56")).toBe(1234.56);
  });

  it("zero com símbolo: 'R$ 0,00' → 0", () => {
    expect(parseBRL("R$ 0,00")).toBe(0);
  });

  it("símbolo + milhar: 'R$ 1.234,56' → 1234.56", () => {
    expect(parseBRL("R$ 1.234,56")).toBe(1234.56);
  });

  it("ponto de milhar sem decimal: '1.234' → 1234", () => {
    expect(parseBRL("1.234")).toBe(1234);
  });

  it("milhões: '1.234.567,89' → 1234567.89", () => {
    expect(parseBRL("1.234.567,89")).toBe(1234567.89);
  });

  it("inteiro puro: '2500' → 2500", () => {
    expect(parseBRL("2500")).toBe(2500);
  });

  it("um decimal após o ponto: '99.9' → 99.9", () => {
    expect(parseBRL("99.9")).toBe(99.9);
  });

  it("vazio → 0", () => {
    expect(parseBRL("")).toBe(0);
  });
});

describe("parseValor (via parseImportRows)", () => {
  const ctx = { operadoras: [], canais: [], defaultEtapa: "Montagem de contrato" as const };
  const row = (valor: unknown) => ({ cliente: "Teste", valor_mensal: valor });

  it("valor numérico 1234.56 permanece 1234.56", () => {
    const r = parseImportRows([row(1234.56)], ctx);
    expect(r.errors).toHaveLength(0);
    expect(r.valid[0].valor_mensal).toBe(1234.56);
  });

  it("'0,00' é aceito como 0 (não é mais 'Valor inválido')", () => {
    const r = parseImportRows([row("0,00")], ctx);
    expect(r.errors).toHaveLength(0);
    expect(r.valid[0].valor_mensal).toBe(0);
  });

  it("'R$ 0,00' é aceito como 0", () => {
    const r = parseImportRows([row("R$ 0,00")], ctx);
    expect(r.errors).toHaveLength(0);
    expect(r.valid[0].valor_mensal).toBe(0);
  });

  it("string BR '1.234,56' → 1234.56", () => {
    const r = parseImportRows([row("1.234,56")], ctx);
    expect(r.valid[0].valor_mensal).toBe(1234.56);
  });

  it("decimal americano em string '1234.56' → 1234.56 (não multiplica por 100)", () => {
    const r = parseImportRows([row("1234.56")], ctx);
    expect(r.valid[0].valor_mensal).toBe(1234.56);
  });

  it("sem dígitos ('abc') → erro 'Valor inválido'", () => {
    const r = parseImportRows([row("abc")], ctx);
    expect(r.errors).toHaveLength(1);
  });

  it("vazio → erro", () => {
    const r = parseImportRows([row("")], ctx);
    expect(r.errors).toHaveLength(1);
  });
});

describe("localIso", () => {
  it("devolve yyyy-mm-dd no fuso local (nunca UTC)", () => {
    // 23h30 local: toISOString() daria o dia seguinte em UTC-3;
    // localIso deve manter o dia local.
    const d = new Date(2026, 6, 15, 23, 30, 0); // 15/07/2026 23:30 local
    expect(localIso(d)).toBe("2026-07-15");
  });

  it("primeiro dia do mês à meia-noite local", () => {
    const d = new Date(2026, 0, 1, 0, 0, 0);
    expect(localIso(d)).toBe("2026-01-01");
  });
});

describe("formatBRL (round-trip)", () => {
  it("parseBRL(formatBRL(x)) === x", () => {
    for (const x of [0, 1234.56, 99.9, 1234567.89, 2500]) {
      expect(parseBRL(formatBRL(x))).toBe(x);
    }
  });
});
