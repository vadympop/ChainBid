type DataGridProps = {
  data: [string, string][];
  className?: string;
  compact?: boolean;
};

export const DataGrid = ({ data, className = "", compact = false }: DataGridProps) => (
  <div className={`grid grid-cols-2 gap-px bg-white/5 ${className}`}>
    {data.map(([label, value]) => (
      <div key={label} className={compact ? "bg-black/30 px-3 py-2" : "bg-[#0a1224] px-4 py-3"}>
        <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
        <p className={`m-0 mt-1 font-mono text-xs text-white${compact ? "" : " break-all"}`}>{value}</p>
      </div>
    ))}
  </div>
);
