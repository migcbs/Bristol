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
      "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold tracking-tight transition-all duration-200 ease-out active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      variant === "primary" &&
        "bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_rgba(43,43,122,0.55)] hover:bg-primary-dark hover:shadow-[0_14px_28px_-10px_rgba(43,43,122,0.6)] focus-visible:ring-primary",
      variant === "accent" &&
        "bg-accent text-accent-foreground shadow-[0_10px_24px_-10px_rgba(230,51,41,0.55)] hover:bg-accent-dark hover:shadow-[0_14px_28px_-10px_rgba(230,51,41,0.6)] focus-visible:ring-accent",
      variant === "outline" &&
        "border border-border bg-transparent hover:border-primary hover:text-primary focus-visible:ring-primary",
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";
