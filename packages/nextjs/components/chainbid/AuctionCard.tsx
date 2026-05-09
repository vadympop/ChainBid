"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { AuctionStatusBadge } from "~~/components/chainbid/AuctionStatusBadge";
import { AssetType, AuctionStatus, AuctionType, TokenType } from "~~/types/chainbid";
import type { AuctionRecord, ChainBidMetadata, DutchAuctionInfo, EnglishAuctionInfo } from "~~/types/chainbid";
import { dutchAuctionAbi, englishAuctionAbi, erc721Abi, erc1155Abi } from "~~/utils/chainbid/abis";
import {
  formatEth,
  getAuctionStatus,
  getDutchPrice,
  getEnglishPrice,
  getTimeLeft,
  normalizeAuctionItem,
} from "~~/utils/chainbid/auction";
import { fetchChainBidMetadata } from "~~/utils/chainbid/ipfs";

type AuctionCardProps = {
  record: AuctionRecord;
  typeFilter: "All" | "English" | "Dutch";
  assetFilter: "All" | "Digital" | "Physical";
  statusFilter: "All" | "Active" | "Ended" | "Finalized" | "Awaiting confirmation";
};

const matchesStatusFilter = (status: AuctionStatus, filter: AuctionCardProps["statusFilter"]) => {
  if (filter === "All") return true;
  if (filter === "Active") return status === "active";
  if (filter === "Ended") return status === "ended";
  if (filter === "Finalized") return status === "finalized";
  return status === "awaiting-confirmation";
};

export const AuctionCard = ({ record, typeFilter, assetFilter, statusFilter }: AuctionCardProps) => {
  const [metadata, setMetadata] = useState<ChainBidMetadata>();
  const isEnglish = Number(record.auctionType) === AuctionType.English;
  const isDutch = Number(record.auctionType) === AuctionType.Dutch;

  const { data: englishInfo, isLoading: isEnglishLoading } = useReadContract({
    address: record.contractAddress,
    abi: englishAuctionAbi,
    functionName: "getAuctionInfo",
    query: { enabled: isEnglish },
  });
  const { data: dutchInfo, isLoading: isDutchLoading } = useReadContract({
    address: record.contractAddress,
    abi: dutchAuctionAbi,
    functionName: "getAuctionInfo",
    query: { enabled: isDutch },
  });

  const info = (isEnglish ? englishInfo : dutchInfo) as EnglishAuctionInfo | DutchAuctionInfo | undefined;
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

  useEffect(() => {
    if (!tokenUri || !item) return;

    let ignore = false;
    fetchChainBidMetadata(tokenUri, { contractAddress: item.tokenContract, tokenId: item.tokenId }).then(result => {
      if (!ignore) setMetadata(result);
    });

    return () => {
      ignore = true;
    };
  }, [item, tokenUri]);

  if (typeFilter !== "All" && typeFilter !== (isEnglish ? "English" : "Dutch")) return null;
  if (!info || !item) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="skeleton h-44 w-full rounded-lg bg-white/10" />
        <div className="mt-4 h-5 w-2/3 rounded bg-white/10" />
        <div className="mt-2 h-4 w-full rounded bg-white/10" />
      </div>
    );
  }

  const status = getAuctionStatus(info.endTime, info.finalized, item.assetType, info.winner, info.receivedConfirmed);
  const price = isEnglish ? getEnglishPrice(info as EnglishAuctionInfo) : getDutchPrice(info as DutchAuctionInfo);
  const assetLabel = item.assetType === AssetType.Digital ? "Digital" : "Physical";

  if (assetFilter !== "All" && assetFilter !== assetLabel) return null;
  if (!matchesStatusFilter(status, statusFilter)) return null;

  return (
    <Link
      href={`/auction/${record.contractAddress}`}
      className="group overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] transition hover:-translate-y-0.5 hover:border-blue-400/50 hover:bg-white/[0.06]"
    >
      <div className="aspect-[4/3] bg-slate-950">
        {metadata?.image ? (
          <img src={metadata.image} alt={metadata.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-600">
            {isEnglishLoading || isDutchLoading ? "Loading auction..." : "Metadata pending"}
          </div>
        )}
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <AuctionStatusBadge kind="auction" auctionType={isEnglish ? AuctionType.English : AuctionType.Dutch} />
          <AuctionStatusBadge kind="asset" assetType={item.assetType} />
          <AuctionStatusBadge kind="status" status={status} />
        </div>
        <div>
          <h3 className="m-0 truncate text-lg font-semibold text-white group-hover:text-blue-100">
            {metadata?.name || `Token #${item.tokenId.toString()}`}
          </h3>
          <p className="m-0 mt-1 line-clamp-2 min-h-10 text-sm text-slate-400">
            {metadata?.description || "NFT-backed auction on ChainBid."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="m-0 text-xs text-slate-500">{isEnglish ? "Current bid" : "Current price"}</p>
            <p className="m-0 font-semibold text-white">{formatEth(price)}</p>
          </div>
          <div>
            <p className="m-0 text-xs text-slate-500">Time left</p>
            <p className="m-0 font-semibold text-white">{getTimeLeft(info.endTime)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
};
