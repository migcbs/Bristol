import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Table(props: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className="w-full border-collapse text-left text-sm" {...props} />
  );
}

export function TableHead(props: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={clsx("border-b border-border px-4 py-2 font-semibold text-gray-600", props.className)}
      {...props}
    />
  );
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className="hover:bg-surface" {...props} />;
}

export function TableCell(props: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx("border-b border-border px-4 py-2", props.className)} {...props} />;
}
