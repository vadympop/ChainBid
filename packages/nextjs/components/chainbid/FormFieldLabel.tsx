import type { ReactNode } from "react";

export const FormFieldLabel = ({ children }: { children: ReactNode }) => (
  <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{children}</p>
);
