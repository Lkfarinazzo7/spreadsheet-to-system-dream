export const formatCurrency = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const formatDate = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v + (v.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("pt-BR");
};

export const formatMonth = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v + (v.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
};

export const monthKey = (v: string | Date) => {
  const d = typeof v === "string" ? new Date(v + (v.length === 10 ? "T00:00:00" : "")) : v;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Format a number as Brazilian Real (R$ 1.234,56). */
export const formatBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));

/** Today (or a given Date) as yyyy-mm-dd in the LOCAL timezone.
 *  Never use `new Date().toISOString().slice(0,10)` for "hoje": após as 21h
 *  no horário de Brasília isso devolve o dia seguinte (UTC). */
export const localIso = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Valida uma data ISO sem aceitar a normalização automática de 31/02 para março. */
export const isValidIsoDate = (value: string | null | undefined): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

/** Soma anos a uma data ISO, preservando o fim do mês (29/02 → 28/02). */
export const addYearsIso = (value: string, years: number): string => {
  if (!isValidIsoDate(value) || !Number.isInteger(years)) return value;
  const [year, month, day] = value.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate();
  return `${year + years}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
};

/** Parse a BRL formatted string ("1.234,56" or "R$ 1.234,56") to a number.
 *  Also handles US-style decimals ("1234.56") to avoid multiplying values by 100
 *  when a spreadsheet exports numbers with a dot as decimal separator. */
export const parseBRL = (s: string): number => {
  if (!s) return 0;
  let clean = String(s).replace(/[^\d,.-]/g, "");
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // Quando existem ambos, o último separador é o decimal:
    // 1.234,56 (BR) ou 1,234.56 (EUA).
    clean = lastComma > lastDot
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const commas = (clean.match(/,/g) ?? []).length;
    const looksThousands = commas > 1 || (commas === 1 && /,\d{3}$/.test(clean));
    clean = looksThousands ? clean.replace(/,/g, "") : clean.replace(",", ".");
  } else {
    // Sem vírgula: um único ponto seguido de 1-2 dígitos no fim = decimal (ex. "1234.56");
    // caso contrário, pontos são separadores de milhar (ex. "1.234")
    const dots = (clean.match(/\./g) ?? []).length;
    const looksDecimal = dots === 1 && /\.\d{1,2}$/.test(clean);
    if (!looksDecimal) clean = clean.replace(/\./g, "");
  }
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
};

/** Mask a Brazilian phone number: (11) 91234-5678 / (11) 1234-5678 */
export const maskPhone = (s: string): string => {
  const d = String(s ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/** Calculate completed years between birth date (ISO yyyy-mm-dd) and today. */
export const getAge = (isoBirth: string | null | undefined): number | null => {
  if (!isoBirth) return null;
  const [y, m, d] = isoBirth.split("-").map(Number);
  if (!y || !m || !d) return null;
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const md = now.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
};
