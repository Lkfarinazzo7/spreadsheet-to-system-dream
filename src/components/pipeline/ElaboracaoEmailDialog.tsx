import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Mail, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ADM_EMAIL_KEY = "elaboracao:adm_email";

export function ElaboracaoEmailDialog({
  open,
  onOpenChange,
  assunto: assuntoIn,
  corpo: corpoIn,
  titulo = "E-mail de elaboração",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assunto: string;
  corpo: string;
  titulo?: string;
}) {
  const { toast } = useToast();
  const [assunto, setAssunto] = useState(assuntoIn);
  const [corpo, setCorpo] = useState(corpoIn);
  const [adm, setAdm] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setAssunto(assuntoIn);
      setCorpo(corpoIn);
      setAdm(localStorage.getItem(ADM_EMAIL_KEY) ?? "");
      setCopied(false);
    }
  }, [open, assuntoIn, corpoIn]);

  const copy = async () => {
    await navigator.clipboard.writeText(corpo);
    setCopied(true);
    toast({ title: "Texto copiado" });
    setTimeout(() => setCopied(false), 1500);
  };

  const openMail = () => {
    if (adm) localStorage.setItem(ADM_EMAIL_KEY, adm);
    const params = new URLSearchParams({ subject: assunto, body: corpo });
    window.location.href = `mailto:${encodeURIComponent(adm)}?${params.toString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>E-mail do ADM</Label>
              <Input
                type="email"
                placeholder="adm@operadora.com"
                value={adm}
                onChange={(e) => setAdm(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assunto</Label>
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Corpo</Label>
            <Textarea
              rows={18}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button type="button" onClick={openMail}>
            <Mail className="h-4 w-4" /> Abrir no e-mail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}