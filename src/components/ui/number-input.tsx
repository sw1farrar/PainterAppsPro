"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NumberInputBaseProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "defaultValue"
> & {
  /** Parse as integer (default false = decimal). */
  integer?: boolean;
  /** Select all on focus (default true; passed through to Input). */
  selectOnFocus?: boolean;
};

export type NumberInputProps = NumberInputBaseProps &
  (
    | {
        nullable?: false;
        value: number | null | undefined;
        onChange: (value: number) => void;
        /** Committed when the field is left empty (default 0). */
        emptyValue?: number;
      }
    | {
        nullable: true;
        value: number | null | undefined;
        onChange: (value: number | null) => void;
        emptyValue?: never;
      }
  );

function formatNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return String(n);
}

function parseNum(raw: string, integer: boolean): number | null {
  const t = raw.trim();
  if (t === "" || t === "-" || t === "." || t === "-.") return null;
  const n = integer ? Number.parseInt(t, 10) : Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function isAllowedDraft(raw: string, integer: boolean): boolean {
  if (raw === "") return true;
  return integer ? /^-?\d*$/.test(raw) : /^-?\d*\.?\d*$/.test(raw);
}

/**
 * Number field that keeps a draft string while focused so you can clear / backspace
 * zeros, and selects contents on focus (via Input).
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(props, ref) {
    const {
      value,
      onChange,
      emptyValue = 0,
      nullable = false,
      integer = false,
      selectOnFocus = true,
      onFocus,
      onBlur,
      className,
      inputMode,
      ...rest
    } = props;

    const [draft, setDraft] = React.useState<string | null>(null);
    const display = draft ?? formatNum(value);

    function commit(raw: string) {
      const n = parseNum(raw, integer);
      if (nullable) {
        (onChange as (v: number | null) => void)(n);
        return;
      }
      (onChange as (v: number) => void)(n ?? emptyValue);
    }

    return (
      <Input
        {...rest}
        ref={ref}
        type="text"
        inputMode={inputMode ?? (integer ? "numeric" : "decimal")}
        selectOnFocus={selectOnFocus}
        value={display}
        className={cn(
          "tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          className
        )}
        onFocus={(e) => {
          setDraft(formatNum(value));
          onFocus?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          if (!isAllowedDraft(raw, integer)) return;
          setDraft(raw);
          const n = parseNum(raw, integer);
          if (n != null) {
            if (nullable) (onChange as (v: number | null) => void)(n);
            else (onChange as (v: number) => void)(n);
          }
        }}
        onBlur={(e) => {
          commit(draft ?? "");
          setDraft(null);
          onBlur?.(e);
        }}
      />
    );
  }
);

export { NumberInput };
