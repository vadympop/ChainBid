"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo } from "react";
import Link from "next/link";
import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { AuctionStatusBadge } from "~~/components/chainbid/AuctionStatusBadge";
import { useChainBidMetadata } from "~~/hooks/chainbid";
import { AssetType, AuctionStatus, AuctionType, TokenType } from "~~/types/chainbid";
import type { AuctionRecord, DutchAuctionInfo, EnglishAuctionInfo, VickreyAuctionInfo } from "~~/types/chainbid";
import { dutchAuctionAbi, englishAuctionAbi, erc721Abi, erc1155Abi, vickreyAuctionAbi } from "~~/utils/chainbid/abis";
import {
  AUCTION_REFRESH_INTERVAL_MS,
  AUCTION_TYPE_LABELS,
  compactAddress,
  formatEth,
  getAuctionStatus,
  getDutchPrice,
  getEnglishPrice,
  getTimeLeft,
  getVickreyAuctionStatus,
  getVickreyPhaseEndTime,
  getVickreyPrice,
  normalizeAuctionItem,
} from "~~/utils/chainbid/auction";

export type AuctionCardResolvedData = {
  name: string;
  price: bigint;
  endTime: bigint;
  status: AuctionStatus;
  assetType: "Digital" | "Physical";
};

type AuctionCardProps = {
  record: AuctionRecord;
  now: bigint;
  onResolved?: (address: Address, data: AuctionCardResolvedData) => void;
};

export const AuctionCard = ({ record, now, onResolved }: AuctionCardProps) => {
  const isEnglish = Number(record.auctionType) === AuctionType.English;
  const isDutch = Number(record.auctionType) === AuctionType.Dutch;
  const isVickrey = Number(record.auctionType) === AuctionType.Vickrey;
  const recordTypeLabel = AUCTION_TYPE_LABELS[Number(record.auctionType) as AuctionType];

  const { data: englishInfo, isLoading: isEnglishLoading } = useReadContract({
    address: record.contractAddress,
    abi: englishAuctionAbi,
    functionName: "getAuctionInfo",
    query: {
      enabled: isEnglish,
      refetchInterval: AUCTION_REFRESH_INTERVAL_MS,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const { data: dutchInfo, isLoading: isDutchLoading } = useReadContract({
    address: record.contractAddress,
    abi: dutchAuctionAbi,
    functionName: "getAuctionInfo",
    query: {
      enabled: isDutch,
      refetchInterval: AUCTION_REFRESH_INTERVAL_MS,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const { data: dutchCurrentPrice } = useReadContract({
    address: record.contractAddress,
    abi: dutchAuctionAbi,
    functionName: "getCurrentPrice",
    query: {
      enabled: Boolean(isDutch && !(dutchInfo as DutchAuctionInfo | undefined)?.finalized),
      refetchInterval: AUCTION_REFRESH_INTERVAL_MS,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const { data: vickreyInfo, isLoading: isVickreyLoading } = useReadContract({
    address: record.contractAddress,
    abi: vickreyAuctionAbi,
    functionName: "getAuctionInfo",
    query: {
      enabled: isVickrey,
      refetchInterval: AUCTION_REFRESH_INTERVAL_MS,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });

  const info = (isEnglish ? englishInfo : isDutch ? dutchInfo : vickreyInfo) as
    | EnglishAuctionInfo
    | DutchAuctionInfo
    | VickreyAuctionInfo
    | undefined;
  const item = useMemo(() => (info ? normalizeAuctionItem(info.item) : undefined), [info]);

  const { data: erc721TokenUri } = useReadContract({
    address: item?.tokenContract,
    abi: erc721Abi,
    functionName: "tokenURI",
    args: [item?.tokenId || 0n],
    query: { enabled: Boolean(item && item.tokenType === TokenType.ERC721 && !item.metadataURI) },
  });
  const { data: erc1155TokenUri } = useReadContract({
    address: item?.tokenContract,
    abi: erc1155Abi,
    functionName: "uri",
    args: [item?.tokenId || 0n],
    query: { enabled: Boolean(item && item.tokenType === TokenType.ERC1155 && !item.metadataURI) },
  });

  const tokenUri = item?.metadataURI || erc721TokenUri || erc1155TokenUri || "";
  const { metadata } = useChainBidMetadata(tokenUri, item?.tokenContract, item?.tokenId);

  const resolved = useMemo(() => {
    if (!info || !item) return null;
    const status = isVickrey
      ? getVickreyAuctionStatus(
          (info as VickreyAuctionInfo).commitEndTime,
          (info as VickreyAuctionInfo).revealEndTime,
          info.finalized,
          item.assetType,
          info.winner,
          info.receivedConfirmed,
          now,
        )
      : getAuctionStatus(
          (info as EnglishAuctionInfo | DutchAuctionInfo).endTime,
          info.finalized,
          item.assetType,
          info.winner,
          info.receivedConfirmed,
          now,
        );
    const price = isEnglish
      ? getEnglishPrice(info as EnglishAuctionInfo)
      : isDutch && (info as DutchAuctionInfo).finalized
        ? getDutchPrice(info as DutchAuctionInfo)
        : isDutch
          ? (dutchCurrentPrice ?? getDutchPrice(info as DutchAuctionInfo))
          : getVickreyPrice(info as VickreyAuctionInfo);
    const timeTarget = isVickrey
      ? getVickreyPhaseEndTime(info as VickreyAuctionInfo, now)
      : (info as EnglishAuctionInfo | DutchAuctionInfo).endTime;
    const endTime = isVickrey
      ? (info as VickreyAuctionInfo).revealEndTime
      : (info as EnglishAuctionInfo | DutchAuctionInfo).endTime;
    return { status, price, timeTarget, endTime };
  }, [info, item, isVickrey, isEnglish, isDutch, dutchCurrentPrice, now]);

  useEffect(() => {
    if (!onResolved || !resolved || !item) return;
    onResolved(record.contractAddress, {
      name: metadata?.name ?? "",
      price: resolved.price,
      endTime: resolved.endTime,
      status: resolved.status,
      assetType: item.assetType === AssetType.Digital ? "Digital" : "Physical",
    });
  }, [onResolved, record.contractAddress, resolved, item, metadata?.name]);

  if (!resolved || !item) {
    return (
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a1224]">
        <div className="skeleton aspect-[4/3] w-full bg-white/10" />
        <div className="space-y-3 p-4">
          <div className="h-4 w-1/3 rounded bg-white/10" />
          <div className="h-5 w-2/3 rounded bg-white/10" />
          <div className="h-4 w-full rounded bg-white/10" />
        </div>
      </div>
    );
  }

  const { status, price, timeTarget } = resolved;
  const isPhysical = item.assetType === AssetType.Physical;
  const priceLabel = info!.finalized ? "FINAL" : isEnglish ? "TOP BID" : isDutch ? "ASKING" : "RESERVE";
  const isSettled = status === "finalized" || status === "awaiting-confirmation";
  const isEnded = status === "ended";
  const timeLabel = isSettled
    ? "SOLD"
    : isEnded
      ? "ENDED"
      : isVickrey && (status === "commit" || status === "reveal")
        ? `${status.toUpperCase()} ENDS`
        : "ENDS";
  const timeValue = isSettled || isEnded ? "—" : getTimeLeft(timeTarget, now);
  const timeLeftSeconds = Number(timeTarget) - Number(now);
  const isUrgent = !isSettled && !isEnded && timeLeftSeconds > 0 && timeLeftSeconds < 3600;

  const typeBadgeBg = isEnglish ? "bg-blue-500/50" : isDutch ? "bg-orange-500/50" : "bg-violet-500/50";
  const typeBadgeText = isEnglish ? "text-blue-200" : isDutch ? "text-orange-200" : "text-violet-200";

  return (
    <Link
      href={`/auction/${record.contractAddress}`}
      className="group overflow-hidden rounded-3xl border border-white/10 bg-[#0a1224] transition hover:-translate-y-0.5 hover:border-blue-500/40"
    >
      {/* Image with overlay badges */}
      <div className="relative aspect-[4/4] p-2">
        {metadata?.image ? (
          <img
            src={metadata.image}
            alt={metadata.name}
            className="h-full w-full bg-slate-900 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl bg-slate-900 text-sm text-slate-600">
            {isEnglishLoading || isDutchLoading || isVickreyLoading ? "Loading…" : "Metadata pending"}
          </div>
        )}
        {/* Top-left: type + physical badges */}
        <div className="absolute left-4 top-4 flex items-center gap-1.5">
          <span
            className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${typeBadgeBg} ${typeBadgeText}`}
          >
            {recordTypeLabel}
          </span>
          {isPhysical && (
            <span className="rounded-lg bg-red-500/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200 backdrop-blur-sm">
              Physical
            </span>
          )}
        </div>
        {/* Top-right: status badge */}
        <AuctionStatusBadge status={status} className="absolute right-4 top-4" />
      </div>

      {/* Card body */}
      <div className="space-y-3 p-4">
        <div>
          <p className="m-0 text-xs text-slate-500">{compactAddress(info!.seller)}</p>
          <h3 className="m-0 mt-1 truncate font-semibold text-white group-hover:text-blue-100">
            {metadata?.name || `Token #${item.tokenId.toString()}`}
          </h3>
        </div>
        <div className="flex items-end justify-between gap-2 text-sm">
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{priceLabel}</p>
            <p className="m-0 mt-0.5 font-semibold text-white">{formatEth(price)}</p>
          </div>
          <div className="text-right">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{timeLabel}</p>
            <p className={`m-0 mt-0.5 font-semibold tabular-nums ${isUrgent ? "text-amber-400" : "text-white"}`}>
              {timeValue}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
};
