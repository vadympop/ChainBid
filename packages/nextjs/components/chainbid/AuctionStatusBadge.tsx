import { AssetType, AuctionStatus, AuctionType } from "~~/types/chainbid";
import { ASSET_TYPE_LABELS, AUCTION_TYPE_LABELS } from "~~/utils/chainbid/auction";

const statusClasses: Record<AuctionStatus, string> = {
  active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  ended: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  finalized: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  "awaiting-confirmation": "border-blue-400/30 bg-blue-400/10 text-blue-200",
};

const statusLabels: Record<AuctionStatus, string> = {
  active: "Active",
  ended: "Ended",
  finalized: "Finalized",
  "awaiting-confirmation": "Awaiting confirmation",
};

type AuctionStatusBadgeProps =
  | {
      kind: "status";
      status: AuctionStatus;
    }
  | {
      kind: "auction";
      auctionType: AuctionType;
    }
  | {
      kind: "asset";
      assetType: AssetType;
    };

export const AuctionStatusBadge = (props: AuctionStatusBadgeProps) => {
  if (props.kind === "status") {
    return (
      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[props.status]}`}>
        {statusLabels[props.status]}
      </span>
    );
  }

  if (props.kind === "auction") {
    return (
      <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-100">
        {AUCTION_TYPE_LABELS[props.auctionType]}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200">
      {ASSET_TYPE_LABELS[props.assetType]}
    </span>
  );
};
