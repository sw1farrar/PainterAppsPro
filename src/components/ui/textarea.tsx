"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  handleSelectOnFocus,
  handleSelectOnMouseUp,
} from "@/lib/select-on-focus";

type TextareaProps = React.ComponentProps<"textarea"> & {
  /** Select all contents on focus (default true). */
  selectOnFocus?: boolean;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { className, selectOnFocus = true, onFocus, onMouseUp, ...props },
    ref
  ) {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        onFocus={(e) => {
          if (selectOnFocus) handleSelectOnFocus(e);
          onFocus?.(e);
        }}
        onMouseUp={(e) => {
          if (selectOnFocus) handleSelectOnMouseUp(e);
          onMouseUp?.(e);
        }}
        {...props}
      />
    );
  }
);

export { Textarea };
