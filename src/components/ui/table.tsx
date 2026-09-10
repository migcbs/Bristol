import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Table(props: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      // border-separate + spacing:0 (not border-collapse) so the rounded
      // corners from overflow-hidden actually render — border-collapse
      // clips the border-radius in every browser.
      className={clsx(
        "w-full overflow-hidden rounded-2xl border border-border bg-white text-left text-sm shadow-[0_1px_2px_rgba(20,20,43,0.04),0_12px_28px_-18px_rgba(20,20,43,0.18)]",
        props.className
      )}
      style={{ borderCollapse: "separate", borderSpacing: 0 }}
      {...props}
    />
  );
}

export function TableHead(props: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={clsx(
        "border-b border-border bg-surface px-4 py-3 text-xs font-semibold tracking-wide text-muted uppercase",
        props.className
      )}
      {...props}
    />
  );
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className="transition-colors last:[&_td]:border-b-0 hover:bg-surface/70" {...props} />;
}

export function TableCell(props: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx("border-b border-border px-4 py-3 align-top", props.className)} {...props} />;
}
