import type { Address } from "viem";

export enum TokenType {
  ERC721 = 0,
  ERC1155 = 1,
}

export enum AssetType {
  Digital = 0,
  Physical = 1,
}

export enum AuctionType {
  English = 0,
  Dutch = 1,
  SealedBid = 2,
}

export type AuctionStatus = "active" | "ended" | "finalized" | "awaiting-confirmation";

export type AuctionItem = {
  tokenType: TokenType;
  assetType: AssetType;
  tokenContract: Address;
  tokenId: bigint;
  amount: bigint;
  metadataURI: string;
};

export type AuctionRecord = {
  contractAddress: Address;
  auctionType: AuctionType;
  seller: Address;
  createdAt: bigint;
};

export type ChainBidMetadataAttribute = {
  trait_type?: string;
  value?: string | number | boolean | null;
  [key: string]: unknown;
};

export type ChainBidMetadata = {
  name: string;
  description: string;
  image: string;
  images: string[];
  attributes: ChainBidMetadataAttribute[];
  contractAddress?: string;
  tokenId?: string;
  fetchError?: string;
  raw?: Record<string, unknown>;
};

export type EnglishAuctionInfo = {
  item: AuctionItem;
  seller: Address;
  endTime: bigint;
  finalized: boolean;
  reservePrice: bigint;
  highestBidder: Address;
  highestBid: bigint;
  winner: Address;
  finalPrice: bigint;
  receivedConfirmed: boolean;
};

export type DutchAuctionInfo = {
  item: AuctionItem;
  seller: Address;
  endTime: bigint;
  finalized: boolean;
  reservePrice: bigint;
  startPrice: bigint;
  duration: bigint;
  startTime: bigint;
  currentPrice: bigint;
  winner: Address;
  finalPrice: bigint;
  receivedConfirmed: boolean;
};

export type NormalizedAuction = {
  address: Address;
  auctionType: AuctionType;
  seller: Address;
  createdAt: bigint;
  item: AuctionItem;
  status: AuctionStatus;
  price: bigint;
  reservePrice: bigint;
  endTime: bigint;
  metadata?: ChainBidMetadata;
  isLoading?: boolean;
  error?: string;
};

export type CreateItemForm = {
  title: string;
  description: string;
  assetType: "Digital" | "Physical";
  category: string;
  images: File[];
};

export type CreateAuctionForm = {
  auctionType: "English" | "Dutch";
  assetType: "Digital" | "Physical";
  tokenType: "ERC721" | "ERC1155";
  tokenContract: string;
  tokenId: string;
  amount: string;
  reservePrice: string;
  startPrice: string;
  durationHours: string;
};
