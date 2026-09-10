import { ArrowRight } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  light: "bg-white text-primary hover:bg-accent hover:text-white",
  solid: "bg-white text-primary-dark hover:bg-primary-dark hover:text-white",
  outline: "border border-current text-primary hover:bg-primary hover:text-white",
} as const;

export function PillButton({
  children,
  variant = "solid",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      {...props}
      className={`group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium tracking-wide uppercase transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:outline-none ${VARIANTS[variant]} ${className}`}
    >
      {children}
      <span className="inline-flex transition-transform duration-300 ease-out group-hover:translate-x-1.5">
        <ArrowRight size={16} />
      </span>
    </button>
  );
}
