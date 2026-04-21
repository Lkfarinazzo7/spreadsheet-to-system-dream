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