import type { PipelineFormValues } from "@/components/pipeline/PipelineForm";

export type AntecipacaoEmail = { assunto: string; corpo: string };

const onlyDigits = (s?: string | null) => (s ?? "").replace(/\D/g, "");

const modalidadeFor = (tipo: string, cnpj?: string): string => {
  if (tipo === "PJ") {
    // MEI heuristic: alguns CNPJs MEI; sem regra fácil, default Compulsório
    return "Compulsório";
  }
  if (tipo === "Adesao") return "Adesão";
  return "Individual";
};

export function buildAntecipacaoEmail(
  form: PipelineFormValues,
  operadoraNome?: string | null,
): AntecipacaoEmail {
  const dp = form.dados_proposta ?? {};
  const titular = (dp.titulares ?? [])[0];
  const op = operadoraNome ?? "";

  const titularNome = titular?.nome || form.cliente || "";
  const titularCpf = onlyDigits(titular?.cpf) || onlyDigits(dp.cnpj_cpf);

  const assunto = `Antecipação ${op} ${titularNome} ${titularCpf}`.trim().replace(/\s+/g, " ");

  const linhas: string[] = [];
  linhas.push(assunto);
  linhas.push("");
  linhas.push("Boa tarde!");
  linhas.push("");
  linhas.push("Solicito a antecipação total das parcelas referentes à proposta abaixo.");
  linhas.push("");
  linhas.push("Seguem em anexo o comprovante de pagamento e a cópia da proposta para conferência.");
  linhas.push("");

  const planoLinha = `Plano: ${op} ${dp.categoria ?? ""}`.trim();
  linhas.push(
    form.numero_proposta
      ? `${planoLinha} (código na planilha é o ${form.numero_proposta})`
      : planoLinha,
  );
  if (titular?.email) linhas.push(`E-mail: ${titular.email}`);
  if (titular?.telefone) linhas.push(`Telefone: ${titular.telefone}`);
  if (dp.acomodacao) linhas.push(`Acomodação: ${dp.acomodacao}`);
  linhas.push(`Modalidade: ${modalidadeFor(form.tipo, dp.cnpj_cpf)}`);
  if (dp.cnpj_cpf) linhas.push(`${form.tipo === "PJ" ? "Cnpj" : "Cpf"}: ${dp.cnpj_cpf}`);
  if (form.tipo === "PJ") linhas.push(`Razão social: ${form.cliente ?? ""}`);
  const endereco = (form.tipo === "PJ" ? dp.endereco_empresa : titular?.endereco) || "";
  if (endereco) linhas.push(`Endereço: ${endereco}`);

  return { assunto, corpo: linhas.join("\n") };
}
