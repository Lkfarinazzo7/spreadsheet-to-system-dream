import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEMA = {
  type: "object",
  properties: {
    cliente: { type: "string", description: "Nome do cliente / razão social / titular principal" },
    numero_proposta: { type: "string" },
    tipo: { type: "string", enum: ["PF", "PJ", "Adesao"] },
    cnpj_cpf: { type: "string", description: "CPF (PF) ou CNPJ (PJ), apenas números ou formatado" },
    operadora_nome: { type: "string", description: "Nome literal da operadora detectada no texto" },
    valor_mensal: { type: "number", description: "Valor mensal/total em reais como número" },
    data_vigencia: { type: "string", description: "Data ISO yyyy-mm-dd" },
    data_reajuste: { type: "string", description: "Data ISO yyyy-mm-dd" },
    vidas: { type: "number" },
    qtd_titulares: { type: "number" },
    qtd_dependentes: { type: "number" },
    acomodacao: { type: "string", enum: ["Enfermaria", "Apartamento"] },
    coparticipacao: { type: "string", enum: ["Total", "Parcial", "Não possui"] },
    categoria: { type: "string" },
    endereco_empresa: { type: "string" },
    observacoes: { type: "string" },
    titulares: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          cpf: { type: "string" },
          data_nascimento: { type: "string", description: "ISO yyyy-mm-dd" },
          telefone: { type: "string" },
          email: { type: "string" },
          endereco: { type: "string" },
          plano_anterior: { type: "string" },
          dependentes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                parentesco: { type: "string" },
                nome: { type: "string" },
                cpf: { type: "string" },
                data_nascimento: { type: "string" },
                plano_anterior: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchOperadora(
  nome: string | undefined,
  operadoras: Array<{ id: string; nome: string }>,
): string | null {
  if (!nome) return null;
  const target = normalize(nome);
  for (const o of operadoras) {
    if (normalize(o.nome) === target) return o.id;
  }
  for (const o of operadoras) {
    const n = normalize(o.nome);
    if (target.includes(n) || n.includes(target)) return o.id;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { texto, operadoras = [] } = await req.json();
    if (!texto || typeof texto !== "string" || texto.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Texto vazio ou muito curto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const operadorasList = operadoras
      .map((o: any) => `- ${o.nome}`)
      .join("\n");

    const systemPrompt = `Você extrai dados de propostas de planos de saúde a partir de texto livre em português brasileiro.
Retorne APENAS os campos que conseguir identificar com confiança. Omita o resto.
Datas sempre em formato ISO yyyy-mm-dd. Valores monetários como número (sem R$, sem pontos de milhar).
CPF/CNPJ podem ser retornados formatados ou só números.
Tipo de contrato: PF (pessoa física), PJ (CNPJ/empresa) ou Adesao (adesão por entidade/sindicato).

Operadoras conhecidas do usuário:
${operadorasList || "(nenhuma)"}

Se identificar a operadora, retorne o nome o mais próximo possível dessa lista no campo operadora_nome.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: texto },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_proposta",
              description: "Extrai dados estruturados da proposta",
              parameters: SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extrair_proposta" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione saldo no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    let parsed: any = {};
    if (args) {
      try {
        parsed = typeof args === "string" ? JSON.parse(args) : args;
      } catch (e) {
        console.error("Falha ao parsear args:", e, args);
      }
    }

    const operadora_id = matchOperadora(parsed.operadora_nome, operadoras);

    return new Response(
      JSON.stringify({ extracted: parsed, operadora_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("pipeline-parse error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});