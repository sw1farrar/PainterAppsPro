"use client";

import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";
import {
  handleSelectOnFocus,
  handleSelectOnMouseUp,
} from "@/lib/select-on-focus";

type InputProps = React.ComponentProps<"input"> & {
  /** Select all contents on focus (default true). */
  selectOnFocus?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      className,
      type,
      selectOnFocus = true,
      onFocus,
      onMouseUp,
      ...props
    },
    ref
  ) {
    return (
      <InputPrimitive
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        onFocus={(e) => {
          if (selectOnFocus && type !== "file" && type !== "checkbox" && type !== "radio") {
            handleSelectOnFocus(e);
          }
          onFocus?.(e);
        }}
        onMouseUp={(e) => {
          if (selectOnFocus && type !== "file" && type !== "checkbox" && type !== "radio") {
            handleSelectOnMouseUp(e);
          }
          onMouseUp?.(e);
        }}
        {...props}
      />
    );
  }
);

export { Input };
