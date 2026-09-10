import { TextareaHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={clsx(
        "w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-shadow duration-150 placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
