import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatBRL, parseBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export type MoneyInputProps = {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
};

/**
 * Controlled BRL money input.
 * - Displays formatted value while not focused (e.g. "1.234,56").
 * - Lets user type freely while focused; commits parsed number on blur.
 */
export function MoneyInput({
  value,
  onChange,
  className,
  placeholder = "0,00",
  disabled,
  id,
}: MoneyInputProps) {
  const [focused, setFocused] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(() => formatBRL(value));

  React.useEffect(() => {
    if (!focused) setDraft(formatBRL(value));
  }, [value, focused]);

  return (
    <div className={cn("relative", className)}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
        R$
      </span>
      <Input
        id={id}
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder}
        value={draft}
        className="pl-9 tabular-nums"
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false);
          const n = parseBRL(draft);
          onChange(n);
          setDraft(formatBRL(n));
        }}
      />
    </div>
  );
}