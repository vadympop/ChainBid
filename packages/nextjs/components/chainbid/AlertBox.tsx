import type { ReactNode } from "react";

type AlertBoxVariant = "info" | "warning" | "success" | "error" | "neutral";

const variantClass: Record<AlertBoxVariant, string> = {
  info: "border-blue-400/20 bg-blue-500/10 text-blue-100",
  warning: "border-amber-400/20 bg-amber-500/10 text-amber-100",
  success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  error: "border-red-400/20 bg-red-500/10 text-red-100",
  neutral: "border-white/10 bg-white/[0.03] text-slate-400",
};

type AlertBoxProps = {
  variant?: AlertBoxVariant;
  className?: string;
  children: ReactNode;
};

export const AlertBox = ({ variant = "info", className = "", children }: AlertBoxProps) => (
  <div className={`rounded-xl border p-3 text-sm ${variantClass[variant]} ${className}`}>{children}</div>
);
