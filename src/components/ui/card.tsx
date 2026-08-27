import { HTMLAttributes } from "react";
import { clsx } from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-border bg-white p-7 shadow-[0_1px_2px_rgba(20,20,43,0.04),0_12px_28px_-16px_rgba(20,20,43,0.22)] transition-shadow duration-300 hover:shadow-[0_1px_2px_rgba(20,20,43,0.06),0_20px_36px_-16px_rgba(20,20,43,0.28)]",
        className
      )}
      {...props}
    />
  );
}
