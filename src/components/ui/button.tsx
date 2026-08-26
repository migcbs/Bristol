import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "accent" | "outline";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "primary", ...props }, ref) => (
  <button
    ref={ref}
    className={clsx(
      "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none",
      variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
      variant === "accent" && "bg-accent text-accent-foreground hover:opacity-90",
      variant === "outline" && "border border-border bg-transparent hover:bg-surface",
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";
