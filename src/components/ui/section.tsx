"use client";

import { HTMLAttributes } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";

export function Section({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={clsx("py-16 px-6", className)}
      {...(props as any)}
    >
      {children}
    </motion.section>
  );
}
