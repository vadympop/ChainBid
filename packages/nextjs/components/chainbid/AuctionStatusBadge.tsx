import type { AuctionStatus } from "~~/types/chainbid";

type AuctionStatusBadgeProps = {
  status: AuctionStatus;
  className?: string;
};

export const AuctionStatusBadge = ({ status, className = "" }: AuctionStatusBadgeProps) => {
  if (status === "active" || status === "commit" || status === "reveal") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/70 px-2 py-0.5 backdrop-blur-sm ${className}`}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Live</span>
      </span>
    );
  }

  if (status === "ended") {
    return (
      <span
        className={`rounded-lg bg-slate-500/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 backdrop-blur-sm ${className}`}
      >
        Ended
      </span>
    );
  }

  if (status === "finalized" || status === "awaiting-confirmation") {
    return (
      <span
        className={`rounded-lg bg-blue-500/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200 backdrop-blur-sm ${className}`}
      >
        Sold
      </span>
    );
  }

  return null;
};
