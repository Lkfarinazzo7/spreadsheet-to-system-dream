import type { PipelineFormValues } from "@/components/pipeline/PipelineForm";

export type AntecipacaoEmail = { assunto: string; corpo: string };

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
  const titulares = dp.titulares ?? [];
  const titular = titulares[0];
  const op = operadoraNome ?? "";

  const nomePrincipal = form.cliente || titular?.nome || "";
  const assunto = `Antecipação ${op} ${nomePrincipal}`.trim().replace(/\s+/g, " ");

  const linhas: string[] = [];
  linhas.push(assunto);
  linhas.push("");
  linhas.push("Boa tarde!");
  linhas.push("");
  linhas.push("Solicito a antecipação total das parcelas referentes à proposta abaixo.");
  linhas.push("");
  linhas.push("Seguem em anexo o comprovante de pagamento e a cópia da proposta para conferência.");
  linhas.push("");

  linhas.push(`Plano: ${op} ${dp.categoria ?? ""}`.trim());
  if (form.numero_proposta) linhas.push(`Proposta: ${form.numero_proposta}`);
  if (dp.acomodacao) linhas.push(`Acomodação: ${dp.acomodacao}`);
  linhas.push(`Modalidade: ${modalidadeFor(form.tipo, dp.cnpj_cpf)}`);
  if (dp.cnpj_cpf) linhas.push(`${form.tipo === "PJ" ? "Cnpj" : "Cpf"}: ${dp.cnpj_cpf}`);
  if (form.tipo === "PJ") linhas.push(`Razão social: ${form.cliente ?? ""}`);
  const endereco = (form.tipo === "PJ" ? dp.endereco_empresa : titular?.endereco) || "";
  if (endereco) linhas.push(`Endereço: ${endereco}`);

  if (titular) {
    linhas.push("");
    linhas.push("Dados do Representante");
    linhas.push("");
    linhas.push(`➡️Nome: ${titular.nome ?? ""}`);
    if (titular.cpf) linhas.push(`➡️CPF: ${titular.cpf}`);
    if (titular.email) linhas.push(`➡️Email: ${titular.email}`);
    if (titular.telefone) linhas.push(`➡️Telefone: ${titular.telefone}`);
    linhas.push(`➡️Plano anterior: ${titular.plano_anterior || "Sem plano"}`);

    const deps = titular.dependentes ?? [];
    if (deps.length > 0) {
      linhas.push("");
      linhas.push("👥Dependentes");
      deps.forEach((d) => {
        linhas.push("");
        linhas.push(`➡️Nome: ${d.nome ?? ""}`);
        if (d.parentesco) linhas.push(`➡️Grau de parentesco: ${d.parentesco}`);
        linhas.push(`➡️Plano anterior: ${d.plano_anterior || "Sem plano"}`);
      });
    }
  }

  if (titulares.length > 1) {
    titulares.slice(1).forEach((t, i) => {
      linhas.push("");
      linhas.push(`Titular ${i + 2}`);
      linhas.push(`➡️Nome: ${t.nome ?? ""}`);
      if (t.cpf) linhas.push(`➡️CPF: ${t.cpf}`);
      if (t.email) linhas.push(`➡️Email: ${t.email}`);
      if (t.telefone) linhas.push(`➡️Telefone: ${t.telefone}`);
      linhas.push(`➡️Plano anterior: ${t.plano_anterior || "Sem plano"}`);
      (t.dependentes ?? []).forEach((d) => {
        linhas.push("");
        linhas.push(`➡️Dependente: ${d.nome ?? ""}`);
        if (d.parentesco) linhas.push(`➡️Grau de parentesco: ${d.parentesco}`);
        linhas.push(`➡️Plano anterior: ${d.plano_anterior || "Sem plano"}`);
      });
    });
  }

  return { assunto, corpo: linhas.join("\n") };
}
