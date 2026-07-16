import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isValidIsoDate } from "@/lib/format";

export type DatePickerProps = {
  /** Value as ISO yyyy-mm-dd string (or empty/null). */
  value?: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

const isoToDate = (iso?: string | null): Date | undefined => {
  if (!isValidIsoDate(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const dt = new Date(y, m - 1, d);
  return isValid(dt) ? dt : undefined;
};

const dateToIso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function DatePicker({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
  disabled,
}: DatePickerProps) {
  const selected = isoToDate(value);
  const [text, setText] = React.useState<string>(selected ? format(selected, "dd/MM/yyyy") : "");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setText(selected ? format(selected, "dd/MM/yyyy") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commitText = (raw: string) => {
    if (!raw) {
      onChange(null);
      return;
    }
    const parsed = parse(raw, "dd/MM/yyyy", new Date());
    if (isValid(parsed)) {
      const iso = dateToIso(parsed);
      if (isValidIsoDate(iso)) {
        onChange(iso);
        setText(format(parsed, "dd/MM/yyyy"));
        return;
      }
    }
    // Não deixa um texto inválido aparentar que foi salvo; restaura o valor real.
    setText(selected ? format(selected, "dd/MM/yyyy") : "");
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          // Mask: keep digits and slashes
          const d = e.target.value.replace(/[^\d/]/g, "").slice(0, 10);
          let masked = d;
          // Auto-insert slashes as the user types raw digits
          const digits = d.replace(/\D/g, "");
          if (digits.length > 4) {
            masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
          } else if (digits.length > 2) {
            masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
          } else {
            masked = digits;
          }
          setText(masked);
        }}
        onBlur={() => commitText(text)}
        className="pr-9"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0 top-0 h-full w-9 hover:bg-transparent"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              if (d) {
                onChange(dateToIso(d));
                setText(format(d, "dd/MM/yyyy"));
              } else {
                onChange(null);
                setText("");
              }
              setOpen(false);
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
