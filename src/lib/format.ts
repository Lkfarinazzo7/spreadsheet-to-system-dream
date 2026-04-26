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

/** Parse a BRL formatted string ("1.234,56" or "R$ 1.234,56") to a number. */
export const parseBRL = (s: string): number => {
  if (!s) return 0;
  const clean = String(s)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
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