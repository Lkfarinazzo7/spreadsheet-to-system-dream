import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { maskPhone, getAge } from "@/lib/format";
import type { DadosProposta, Titular, Dependente } from "@/components/pipeline/PipelineForm";

const PARENTESCOS = ["Cônjuge","Filho(a)","Irmão(ã)","Sobrinho(a)","Neto(a)","Mãe","Pai","Sogro(a)","Genro","Nora"] as const;
const NENHUM = "__nenhum__";

const emptyTitular = (): Titular => ({
  nome: "", cpf: "", data_nascimento: null, telefone: "", email: "",
  endereco: "", plano_anterior: "", dependentes: [],
});
const emptyDependente = (): Dependente => ({
  parentesco: "", nome: "", cpf: "", data_nascimento: null, plano_anterior: "",
});

function maskCpf(value: string) {
  return value.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1-$2");
}

export function DadosPropostaEditor({
  value,
  onChange,
  operadoras,
  tipo,
}: {
  value: DadosProposta;
  onChange: (next: DadosProposta) => void;
  operadoras: { id: string; nome: string }[];
  tipo: "PJ" | "PF" | "Adesao";
}) {
  const dp = value;
  const titulares = dp.titulares ?? [];

  const setDP = (patch: Partial<DadosProposta>) => onChange({ ...dp, ...patch });

  // Sync titulares array length with qtd_titulares
  useEffect(() => {
    const target = Number(dp.qtd_titulares) || 0;
    if (target === titulares.length) return;
    if (target > titulares.length) {
      const add = Array.from({ length: target - titulares.length }, emptyTitular);
      setDP({ titulares: [...titulares, ...add] });
    } else {
      setDP({ titulares: titulares.slice(0, target) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dp.qtd_titulares]);

  const updateTitular = (idx: number, patch: Partial<Titular>) => {
    setDP({ titulares: titulares.map((t, i) => (i === idx ? { ...t, ...patch } : t)) });
  };

  const setDepCount = (titIdx: number, count: number) => {
    const t = titulares[titIdx];
    const cur = t.dependentes ?? [];
    const next = count > cur.length
      ? [...cur, ...Array.from({ length: count - cur.length }, emptyDependente)]
      : cur.slice(0, count);
    updateTitular(titIdx, { dependentes: next });
  };

  const updateDep = (ti: number, di: number, patch: Partial<Dependente>) => {
    const t = titulares[ti];
    updateTitular(ti, { dependentes: t.dependentes.map((d, i) => (i === di ? { ...d, ...patch } : d)) });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Input value={dp.categoria ?? ""} onChange={(e) => setDP({ categoria: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Acomodação</Label>
          <Select value={dp.acomodacao ?? ""} onValueChange={(v) => setDP({ acomodacao: v as any })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Enfermaria">Enfermaria</SelectItem>
              <SelectItem value="Apartamento">Apartamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Coparticipação</Label>
          <Select value={dp.coparticipacao ?? ""} onValueChange={(v) => setDP({ coparticipacao: v as any })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Total">Total</SelectItem>
              <SelectItem value="Parcial">Parcial</SelectItem>
              <SelectItem value="Não possui">Não possui</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Vidas</Label>
          <Input type="number" min={0} value={dp.vidas ?? ""} onChange={(e) => setDP({ vidas: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Titulares</Label>
          <Input type="number" min={0} value={dp.qtd_titulares ?? ""} onChange={(e) => setDP({ qtd_titulares: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Dependentes</Label>
          <Input type="number" min={0} value={dp.qtd_dependentes ?? ""} onChange={(e) => setDP({ qtd_dependentes: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </div>
        {tipo === "PJ" && (
          <div className="space-y-1.5 col-span-2 md:col-span-3">
            <Label>Endereço da empresa</Label>
            <Textarea rows={2} value={dp.endereco_empresa ?? ""} onChange={(e) => setDP({ endereco_empresa: e.target.value })} />
          </div>
        )}
      </div>

      {titulares.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Titulares</h4>
          {titulares.map((t, idx) => (
            <Card key={idx}>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Titular {idx + 1}</Badge>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Dependentes:</Label>
                    <Input type="number" min={0} className="h-8 w-20" value={t.dependentes.length}
                      onChange={(e) => setDepCount(idx, Math.max(0, Number(e.target.value)))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Nome</Label>
                    <Input value={t.nome} onChange={(e) => updateTitular(idx, { nome: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">CPF</Label>
                    <Input value={t.cpf} onChange={(e) => updateTitular(idx, { cpf: maskCpf(e.target.value) })} /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Nascimento {t.data_nascimento && getAge(t.data_nascimento) != null && (<span className="text-muted-foreground">· {getAge(t.data_nascimento)}a</span>)}
                    </Label>
                    <DatePicker value={t.data_nascimento ?? null} onChange={(iso) => updateTitular(idx, { data_nascimento: iso })} />
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Telefone</Label>
                    <Input value={t.telefone} onChange={(e) => updateTitular(idx, { telefone: maskPhone(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-xs">E-mail</Label>
                    <Input type="email" value={t.email} onChange={(e) => updateTitular(idx, { email: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Plano anterior</Label>
                    <Select value={t.plano_anterior || NENHUM}
                      onValueChange={(v) => updateTitular(idx, { plano_anterior: v === NENHUM ? "" : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NENHUM}>Nenhum</SelectItem>
                        {operadoras.map((o) => (<SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-2 md:col-span-3"><Label className="text-xs">Endereço</Label>
                    <Textarea rows={1} value={t.endereco} onChange={(e) => updateTitular(idx, { endereco: e.target.value })} /></div>
                </div>

                {t.dependentes.length > 0 && (
                  <div className="border-l-2 border-primary/40 pl-3 space-y-2">
                    {t.dependentes.map((d, dIdx) => (
                      <div key={dIdx} className="border rounded-md p-2">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="text-xs">Dependente {dIdx + 1}</Badge>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => setDepCount(idx, t.dependentes.length - 1)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          <div className="space-y-1"><Label className="text-xs">Parentesco</Label>
                            <Select value={d.parentesco || ""} onValueChange={(v) => updateDep(idx, dIdx, { parentesco: v })}>
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>{PARENTESCOS.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1"><Label className="text-xs">Nome</Label>
                            <Input value={d.nome} onChange={(e) => updateDep(idx, dIdx, { nome: e.target.value })} /></div>
                          <div className="space-y-1"><Label className="text-xs">CPF</Label>
                            <Input value={d.cpf} onChange={(e) => updateDep(idx, dIdx, { cpf: maskCpf(e.target.value) })} /></div>
                          <div className="space-y-1">
                            <Label className="text-xs">Nascimento {d.data_nascimento && getAge(d.data_nascimento) != null && (<span className="text-muted-foreground">· {getAge(d.data_nascimento)}a</span>)}</Label>
                            <DatePicker value={d.data_nascimento ?? null} onChange={(iso) => updateDep(idx, dIdx, { data_nascimento: iso })} />
                          </div>
                          <div className="space-y-1"><Label className="text-xs">Plano anterior</Label>
                            <Select value={d.plano_anterior || NENHUM}
                              onValueChange={(v) => updateDep(idx, dIdx, { plano_anterior: v === NENHUM ? "" : v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NENHUM}>Nenhum</SelectItem>
                                {operadoras.map((o) => (<SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
