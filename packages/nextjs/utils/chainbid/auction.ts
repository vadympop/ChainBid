import { formatEther, isAddress, zeroAddress } from "viem";
import type { Address } from "viem";
import { AssetType, AuctionStatus, AuctionType, TokenType } from "~~/types/chainbid";
import type { AuctionItem, DutchAuctionInfo, EnglishAuctionInfo } from "~~/types/chainbid";

export const MIN_AUCTION_DURATION_SECONDS = 10 * 60;

export const TOKEN_TYPE_LABELS: Record<TokenType, string> = {
  [TokenType.ERC721]: "ERC-721",
  [TokenType.ERC1155]: "ERC-1155",
};

export const ASSET_TYPE_LABELS: Record<AssetType, "Digital" | "Physical"> = {
  [AssetType.Digital]: "Digital",
  [AssetType.Physical]: "Physical",
};

export const AUCTION_TYPE_LABELS: Record<AuctionType, string> = {
  [AuctionType.English]: "English",
  [AuctionType.Dutch]: "Dutch",
  [AuctionType.SealedBid]: "Sealed bid",
};

export const isZeroAddress = (value?: string) => !value || value.toLowerCase() === zeroAddress;

export const compactAddress = (address?: string) => {
  if (!address) return "Not set";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatEth = (value?: bigint) => {
  if (value === undefined) return "0 ETH";
  const formatted = Number(formatEther(value));
  return `${formatted.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH`;
};

export const secondsFromHours = (hours: string) => {
  const parsed = Number(hours);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0n;
  return BigInt(Math.round(parsed * 60 * 60));
};

export const parseTokenIdInput = (value: string) => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  return BigInt(trimmed);
};

export const getAuctionStatus = (
  endTime: bigint,
  finalized: boolean,
  assetType: AssetType,
  winner: Address,
  receivedConfirmed: boolean,
): AuctionStatus => {
  if (finalized && assetType === AssetType.Physical && !isZeroAddress(winner) && !receivedConfirmed) {
    return "awaiting-confirmation";
  }
  if (finalized) return "finalized";
  return BigInt(Math.floor(Date.now() / 1000)) >= endTime ? "ended" : "active";
};

export const getTimeLeft = (endTime?: bigint) => {
  if (!endTime) return "Unknown";

  const remaining = Number(endTime - BigInt(Math.floor(Date.now() / 1000)));
  if (remaining <= 0) return "Ended";

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const normalizeAuctionItem = (item: AuctionItem): AuctionItem => ({
  tokenType: Number(item.tokenType) as TokenType,
  assetType: Number(item.assetType) as AssetType,
  tokenContract: item.tokenContract,
  tokenId: BigInt(item.tokenId),
  amount: BigInt(item.amount),
  metadataURI: item.metadataURI || "",
});

export const getEnglishPrice = (info?: EnglishAuctionInfo) => {
  if (!info) return 0n;
  return info.highestBid > 0n ? info.highestBid : info.reservePrice;
};

export const getDutchPrice = (info?: DutchAuctionInfo) => {
  if (!info) return 0n;
  return info.currentPrice > 0n ? info.currentPrice : info.reservePrice;
};

export const validateTokenAddress = (value: string): value is Address => isAddress(value);

export const buildAuctionItem = (params: {
  assetType: AssetType;
  metadataURI: string;
  tokenContract: Address;
  tokenId: bigint;
}): AuctionItem => ({
  tokenType: TokenType.ERC721,
  assetType: params.assetType,
  tokenContract: params.tokenContract,
  tokenId: params.tokenId,
  amount: 1n,
  metadataURI: params.metadataURI,
});
