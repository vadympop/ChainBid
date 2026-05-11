import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

export const StatCard = ({ label, value, valueClassName = "mt-2 text-4xl font-bold text-blue-400" }: StatCardProps) => (
  <div className="rounded-2xl border border-white/10 bg-[#0a1224] p-5">
    <p className="m-0 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
    <p className={`m-0 ${valueClassName}`}>{value}</p>
  </div>
);
