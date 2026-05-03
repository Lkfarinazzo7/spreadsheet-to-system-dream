import type { PipelineFormValues } from "@/components/pipeline/PipelineForm";

export type ElaboracaoEmail = { assunto: string; corpo: string };

const modalidadeFor = (tipo: string): string => {
  if (tipo === "PJ") return "Compulsório";
  if (tipo === "Adesao") return "Adesão";
  return "Individual";
};

const pessoaFor = (tipo: string): string =>
  tipo === "PJ" ? "Pessoa Jurídica" : tipo === "Adesao" ? "Adesão" : "Pessoa Física";

const onlyDigits = (s?: string | null) => (s ?? "").replace(/\D/g, "");

export function buildElaboracaoEmail(
  form: PipelineFormValues,
  operadoraNome?: string | null,
): ElaboracaoEmail {
  const dp = form.dados_proposta ?? {};
  const titulares = dp.titulares ?? [];
  const titular = titulares[0];
  const op = operadoraNome ?? "";

  const titularNome = titular?.nome || form.cliente || "";
  const titularCpf = onlyDigits(titular?.cpf) || onlyDigits(dp.cnpj_cpf);

  const assunto = `Elaboração ${op} ${titularNome} ${titularCpf}`.trim().replace(/\s+/g, " ");

  const linhas: string[] = [];
  linhas.push(assunto);
  linhas.push("");
  linhas.push(`Elaboração ${op} ${pessoaFor(form.tipo)}`.trim());
  linhas.push("");
  linhas.push(`Plano: ${op} ${dp.categoria ?? ""}`.trim());
  if (dp.acomodacao) linhas.push(`➡️Acomodação: ${dp.acomodacao}`);
  linhas.push(`➡️Modalidade: ${modalidadeFor(form.tipo)}`);
  if (dp.cnpj_cpf) linhas.push(`➡️${form.tipo === "PJ" ? "Cnpj" : "Cpf"}: ${dp.cnpj_cpf}`);
  if (form.tipo === "PJ") linhas.push(`➡️Razão social: ${form.cliente ?? ""}`);
  const endereco = (form.tipo === "PJ" ? dp.endereco_empresa : titular?.endereco) || "";
  if (endereco) linhas.push(`➡️Endereço de correspondência: ${endereco}`);

  if (titular) {
    linhas.push("");
    linhas.push("Dados do Representante");
    linhas.push("");
    linhas.push(`➡️Nome: ${titular.nome ?? ""}`);
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

  linhas.push("");
  linhas.push(form.observacoes?.trim() || "Obs: A declaração de permanência ficará pronta em 2 dias úteis");

  return { assunto, corpo: linhas.join("\n") };
}