"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { NextPage } from "next";
import { type Address, encodeAbiParameters, isAddress, keccak256, parseEther, zeroAddress } from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { AlertBox } from "~~/components/chainbid/AlertBox";
import { AuctionStatusBadge } from "~~/components/chainbid/AuctionStatusBadge";
import { DataGrid } from "~~/components/chainbid/DataGrid";
import { FormFieldLabel } from "~~/components/chainbid/FormFieldLabel";
import { ImageThumbnailGrid } from "~~/components/chainbid/ImageThumbnailGrid";
import { TxButton } from "~~/components/chainbid/TxButton";
import { useAuctionNow } from "~~/components/chainbid/useAuctionNow";
import { useChainBidMetadata, useChainBidWriteContract } from "~~/hooks/chainbid";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { AssetType, AuctionType, TokenType } from "~~/types/chainbid";
import type {
  AuctionRecord,
  DutchAuctionInfo,
  EnglishAuctionInfo,
  VickreyAuctionInfo,
  VickreyBidCommitment,
} from "~~/types/chainbid";
import {
  bidPlacedEventAbi,
  dutchAuctionAbi,
  englishAuctionAbi,
  erc721Abi,
  erc1155Abi,
  vickreyAuctionAbi,
} from "~~/utils/chainbid/abis";
import {
  AUCTION_REFRESH_INTERVAL_MS,
  TOKEN_TYPE_LABELS,
  compactAddress,
  formatEth,
  getAuctionStatus,
  getDutchPrice,
  getEnglishPrice,
  getTimeLeft,
  getVickreyAuctionStatus,
  getVickreyPhaseEndTime,
  getVickreyPrice,
  isZeroAddress,
  normalizeAuctionItem,
  timeAgo,
} from "~~/utils/chainbid/auction";
import { fieldClass } from "~~/utils/chainbid/styles";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

type BidEntry = { bidder: Address; amount: bigint; timestamp: number };

const ZERO_BYTES32 = `0x${"0".repeat(64)}` as const;

const isBytes32Hex = (value: string): value is `0x${string}` => /^0x[0-9a-fA-F]{64}$/.test(value);

const generateSecret = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;
};

const parseEthInput = (value: string) => {
  if (!value) return undefined;
  try {
    return parseEther(value);
  } catch {
    return undefined;
  }
};

const getVickreyCommitmentHash = (bidAmount: string, secret: string) => {
  const parsedBid = parseEthInput(bidAmount);
  if (parsedBid === undefined || !isBytes32Hex(secret)) return undefined;
  return keccak256(
    encodeAbiParameters(
      [
        { name: "bidAmount", type: "uint256" },
        { name: "secret", type: "bytes32" },
      ],
      [parsedBid, secret],
    ),
  );
};

const AuctionDetailPage: NextPage = () => {
  const params = useParams<{ address: string }>();
  const auctionAddress = params.address && isAddress(params.address) ? (params.address as Address) : undefined;
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useChainBidWriteContract();
  const now = useAuctionNow();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const isBusy = isPending || activeAction !== null;
  const [bidAmount, setBidAmount] = useState("");
  const [commitBidAmount, setCommitBidAmount] = useState("");
  const [commitDeposit, setCommitDeposit] = useState("");
  const [revealBidAmount, setRevealBidAmount] = useState("");
  const [vickreySecret, setVickreySecret] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [bidHistory, setBidHistory] = useState<BidEntry[]>([]);

  const vickreyStorageKey = useMemo(() => {
    if (!auctionAddress || !connectedAddress) return undefined;
    return `chainbid:vickrey:${auctionAddress.toLowerCase()}:${connectedAddress.toLowerCase()}`;
  }, [auctionAddress, connectedAddress]);

  const { data: auctions } = useScaffoldReadContract({
    contractName: "AuctionFactory",
    functionName: "getAllAuctions",
  });

  const record = useMemo(() => {
    const records = (auctions || []) as AuctionRecord[];
    return records.find(item => item.contractAddress.toLowerCase() === auctionAddress?.toLowerCase());
  }, [auctionAddress, auctions]);

  const isEnglish = !record || Number(record.auctionType) === AuctionType.English;
  const isDutch = Number(record?.auctionType) === AuctionType.Dutch;
  const isVickrey = Number(record?.auctionType) === AuctionType.Vickrey;
  const auctionAbi = isVickrey ? vickreyAuctionAbi : isDutch ? dutchAuctionAbi : englishAuctionAbi;

  const { data: englishInfo, refetch: refetchEnglish } = useReadContract({
    address: auctionAddress,
    abi: englishAuctionAbi,
    functionName: "getAuctionInfo",
    query: {
      enabled: Boolean(auctionAddress && isEnglish),
      refetchInterval: AUCTION_REFRESH_INTERVAL_MS,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const { data: dutchInfo, refetch: refetchDutch } = useReadContract({
    address: auctionAddress,
    abi: dutchAuctionAbi,
    functionName: "getAuctionInfo",
    query: {
      enabled: Boolean(auctionAddress && isDutch),
      refetchInterval: AUCTION_REFRESH_INTERVAL_MS,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const { data: dutchCurrentPrice, refetch: refetchDutchCurrentPrice } = useReadContract({
    address: auctionAddress,
    abi: dutchAuctionAbi,
    functionName: "getCurrentPrice",
    query: {
      enabled: Boolean(auctionAddress && isDutch && !(dutchInfo as DutchAuctionInfo | undefined)?.finalized),
      refetchInterval: AUCTION_REFRESH_INTERVAL_MS,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const { data: vickreyInfo, refetch: refetchVickrey } = useReadContract({
    address: auctionAddress,
    abi: vickreyAuctionAbi,
    functionName: "getAuctionInfo",
    query: {
      enabled: Boolean(auctionAddress && isVickrey),
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

  const englishHighestBid = isEnglish ? (englishInfo as EnglishAuctionInfo | undefined)?.highestBid : undefined;

  useEffect(() => {
    if (!isEnglish || !auctionAddress || !publicClient || !record) return;
    let cancelled = false;
    (async () => {
      const CHUNK = 950n;
      const latest = await publicClient.getBlock({ blockTag: "latest" });
      if (cancelled) return;

      // record.createdAt is block.timestamp; estimate creation block number
      const secondsAgo = latest.timestamp > record.createdAt ? latest.timestamp - record.createdAt : 0n;
      const blocksAgo = secondsAgo / 12n + 50n;
      const startBlock = latest.number > blocksAgo ? latest.number - blocksAgo : 0n;

      type BidLog = { bidder: Address; amount: bigint; blockNumber: bigint | null };
      const allLogs: BidLog[] = [];
      let from = startBlock;
      while (from <= latest.number) {
        if (cancelled) return;
        const to = from + CHUNK - 1n < latest.number ? from + CHUNK - 1n : latest.number;
        const chunk = await publicClient.getLogs({
          address: auctionAddress,
          event: bidPlacedEventAbi,
          fromBlock: from,
          toBlock: to,
        });
        for (const log of chunk) {
          allLogs.push({
            bidder: log.args.bidder as Address,
            amount: log.args.amount as bigint,
            blockNumber: log.blockNumber,
          });
        }
        from = to + 1n;
      }

      if (cancelled) return;
      if (allLogs.length === 0) {
        setBidHistory([]);
        return;
      }

      const uniqueBlocks = [...new Set(allLogs.map(l => l.blockNumber).filter(Boolean))] as bigint[];
      const blocks = await Promise.all(uniqueBlocks.map(bn => publicClient.getBlock({ blockNumber: bn })));
      if (cancelled) return;
      const tsMap = new Map(blocks.map(b => [b.number, Number(b.timestamp)]));
      const entries: BidEntry[] = allLogs
        .map(log => ({
          bidder: log.bidder,
          amount: log.amount,
          timestamp: log.blockNumber !== null ? (tsMap.get(log.blockNumber) ?? 0) : 0,
        }))
        .reverse();
      setBidHistory(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, [isEnglish, auctionAddress, publicClient, record, englishHighestBid]);

  const { data: vickreyCommitment, refetch: refetchVickreyCommitment } = useReadContract({
    address: auctionAddress,
    abi: vickreyAuctionAbi,
    functionName: "commitments",
    args: [connectedAddress || zeroAddress],
    query: { enabled: Boolean(auctionAddress && connectedAddress && isVickrey) },
  });
  const { data: isVickreyBlocked, refetch: refetchVickreyBlocked } = useReadContract({
    address: auctionAddress,
    abi: vickreyAuctionAbi,
    functionName: "blocked",
    args: [connectedAddress || zeroAddress],
    query: { enabled: Boolean(auctionAddress && connectedAddress && isVickrey) },
  });
  const { data: pendingReturns, refetch: refetchPendingReturns } = useReadContract({
    address: auctionAddress,
    abi: auctionAbi,
    functionName: "pendingReturns",
    args: [connectedAddress || "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(auctionAddress && connectedAddress) },
  });

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
  const { metadata, isLoading: isMetadataLoading } = useChainBidMetadata(tokenUri, item?.tokenContract, item?.tokenId);

  const images = useMemo(() => {
    if (!metadata) return [];
    return [metadata.image, ...metadata.images].filter((img, i, arr) => img && arr.indexOf(img) === i);
  }, [metadata]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [metadata]);

  useEffect(() => {
    if (!vickreyStorageKey) {
      setVickreySecret("");
      setRevealBidAmount("");
      return;
    }
    const storedValue = localStorage.getItem(vickreyStorageKey);
    if (!storedValue) return;
    try {
      const parsed = JSON.parse(storedValue) as { secret?: string; bidAmount?: string; deposit?: string };
      if (parsed.secret && isBytes32Hex(parsed.secret)) setVickreySecret(parsed.secret);
      if (parsed.bidAmount) {
        setCommitBidAmount(parsed.bidAmount);
        setRevealBidAmount(parsed.bidAmount);
      }
      if (parsed.deposit) setCommitDeposit(parsed.deposit);
    } catch {
      localStorage.removeItem(vickreyStorageKey);
    }
  }, [vickreyStorageKey]);

  const refetchInfo = async () => {
    if (isEnglish) await refetchEnglish();
    if (isDutch) {
      await refetchDutch();
      await refetchDutchCurrentPrice();
    }
    if (isVickrey) {
      await refetchVickrey();
      await refetchVickreyCommitment();
      await refetchVickreyBlocked();
    }
    await refetchPendingReturns();
  };

  const runAuctionTx = async (
    actionKey: string,
    label: string,
    request: Parameters<typeof writeContractAsync>[0] & { value?: bigint },
    onSuccess?: () => void,
  ) => {
    if (!auctionAddress) return;
    setActiveAction(actionKey);
    try {
      notification.info(label);
      const hash = await writeContractAsync(request);
      if (!hash) return;
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      notification.success("Transaction confirmed.");
      onSuccess?.();
      await refetchInfo();
    } catch (error) {
      notification.error(getParsedError(error));
    } finally {
      setActiveAction(null);
    }
  };

  const persistVickreyCommitment = (values: { secret: string; bidAmount?: string; deposit?: string }) => {
    if (!vickreyStorageKey || !isBytes32Hex(values.secret)) return;
    localStorage.setItem(
      vickreyStorageKey,
      JSON.stringify({
        secret: values.secret,
        bidAmount: values.bidAmount || revealBidAmount || commitBidAmount,
        deposit: values.deposit || commitDeposit,
      }),
    );
  };

  const handleGenerateVickreySecret = () => {
    const nextSecret = generateSecret();
    setVickreySecret(nextSecret);
    persistVickreyCommitment({ secret: nextSecret, bidAmount: commitBidAmount, deposit: commitDeposit });
  };

  if (!auctionAddress) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center">
        <h2 className="m-0 text-xl font-semibold text-white">Invalid auction address</h2>
        <Link
          href="/"
          className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Back to marketplace
        </Link>
      </div>
    );
  }

  if (!info || !item) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[3fr_2fr] lg:px-8">
        <div className="space-y-4">
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-white/10" />
          <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0a1224] p-5">
            <div className="h-3 w-1/3 rounded bg-white/10" />
            <div className="h-3 w-full rounded bg-white/10" />
            <div className="h-3 w-2/3 rounded bg-white/10" />
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0a1224] p-5">
          <div className="h-3 w-1/4 rounded bg-white/10" />
          <div className="h-8 w-1/2 rounded bg-white/10" />
          <div className="h-16 rounded bg-white/10" />
        </div>
      </div>
    );
  }

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

  const isSeller = connectedAddress?.toLowerCase() === info.seller.toLowerCase();
  const isWinner = connectedAddress?.toLowerCase() === info.winner.toLowerCase();
  const isActive = status === "active";
  const isCommitPhase = status === "commit";
  const isRevealPhase = status === "reveal";
  const isEnded = status === "ended";

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

  const priceLabel = info.finalized ? "Final price" : isEnglish ? "Top bid" : isDutch ? "Asking price" : "Reserve";
  const isSettled = status === "finalized" || status === "awaiting-confirmation";
  const timeLabel = isSettled
    ? "Sold"
    : status === "ended"
      ? "Ended"
      : isVickrey && (isCommitPhase || isRevealPhase)
        ? `${status.charAt(0).toUpperCase() + status.slice(1)} ends`
        : "Ends in";

  const secondaryMetricLabel = isVickrey ? "Valid bids" : "Reserve";
  const secondaryMetricValue = isVickrey
    ? `${(info as VickreyAuctionInfo).validBidCount} / ${(info as VickreyAuctionInfo).totalCommitments}`
    : formatEth(info.reservePrice);

  const timeLeftSeconds = Number(timeTarget) - Number(now);
  const isUrgent = !isSettled && timeLeftSeconds > 0 && timeLeftSeconds < 3600;

  const canFinalize = isEnded && !info.finalized;
  const canConfirm = item.assetType === AssetType.Physical && info.finalized && isWinner && !info.receivedConfirmed;
  const hasRefund = (pendingReturns || 0n) > 0n;

  const userVickreyCommitment = vickreyCommitment
    ? ({
        commitment: vickreyCommitment[0],
        deposit: vickreyCommitment[1],
        revealed: vickreyCommitment[2],
        valid: vickreyCommitment[3],
        bidAmount: vickreyCommitment[4],
      } satisfies VickreyBidCommitment)
    : undefined;
  const hasVickreyCommitment = Boolean(
    userVickreyCommitment?.commitment && userVickreyCommitment.commitment !== ZERO_BYTES32,
  );
  const vickreyCommitmentHash = getVickreyCommitmentHash(commitBidAmount, vickreySecret);
  const parsedCommitBid = parseEthInput(commitBidAmount);
  const parsedCommitDeposit = parseEthInput(commitDeposit);
  const canCommitVickrey = Boolean(
    isCommitPhase &&
      !isSeller &&
      !isVickreyBlocked &&
      !hasVickreyCommitment &&
      vickreyCommitmentHash &&
      parsedCommitBid !== undefined &&
      parsedCommitDeposit !== undefined &&
      parsedCommitDeposit >= parsedCommitBid,
  );
  const parsedRevealBid = parseEthInput(revealBidAmount);
  const canRevealVickrey = Boolean(
    isRevealPhase &&
      !isVickreyBlocked &&
      hasVickreyCommitment &&
      !userVickreyCommitment?.revealed &&
      parsedRevealBid !== undefined &&
      isBytes32Hex(vickreySecret),
  );

  const typeBadgeBg = isEnglish ? "bg-blue-500/70" : isDutch ? "bg-orange-500/70" : "bg-violet-500/70";
  const typeBadgeText = isEnglish ? "text-blue-200" : isDutch ? "text-orange-200" : "text-violet-200";
  const typeLabel = isEnglish ? "English" : isDutch ? "Dutch" : "Vickrey";
  const currentImage = images[selectedImageIndex] || metadata?.image || "";

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[3fr_2fr] lg:px-8">
      {/* ── Left column ── */}
      <aside className="space-y-4">
        {/* Image with overlay badges */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
          <div className="relative aspect-[4/3]">
            {isMetadataLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-600">Loading…</div>
            ) : currentImage ? (
              <img src={currentImage} alt={metadata?.name || "NFT"} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-600">No image</div>
            )}

            {/* Type + physical badges */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5">
              <span
                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${typeBadgeBg} ${typeBadgeText}`}
              >
                {typeLabel}
              </span>
              {item.assetType === AssetType.Physical && (
                <span className="rounded-lg bg-red-500/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200 backdrop-blur-sm">
                  Physical
                </span>
              )}
            </div>

            {/* Status badge */}
            <AuctionStatusBadge status={status} className="absolute right-3 top-3" />
          </div>

          {/* Thumbnails */}
          <ImageThumbnailGrid
            images={images}
            selectedIndex={selectedImageIndex}
            onSelect={setSelectedImageIndex}
            className="p-3"
          />
        </div>

        {/* Provenance & details */}
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <p className="border-b border-white/5 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Provenance & details
          </p>
          <DataGrid
            data={[
              ["Contract", compactAddress(item.tokenContract)],
              ["Token ID", `#${item.tokenId}`],
              ["Standard", TOKEN_TYPE_LABELS[item.tokenType]],
              ["Amount", item.amount.toString()],
              ["Seller", compactAddress(info.seller)],
              ["Winner", isZeroAddress(info.winner) ? "None" : compactAddress(info.winner)],
            ]}
          />
        </div>
      </aside>

      {/* ── Right column ── */}
      <section className="space-y-5">
        {/* Title block */}
        <div>
          <p className="m-0 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            By {compactAddress(info.seller)}
          </p>
          <h1 className="m-0 mt-2 text-3xl font-bold text-white">{metadata?.name || `Token #${item.tokenId}`}</h1>
          {metadata?.description && (
            <p className="m-0 mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">{metadata.description}</p>
          )}
        </div>

        {/* Bid info card */}
        <div className="rounded-2xl border border-white/10 bg-[#0a1224] p-5">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{priceLabel}</p>
          <p className="m-0 mt-1 text-4xl font-bold text-white">{formatEth(price)}</p>
          <div className="mt-4 flex gap-8 border-t border-white/10 pt-4">
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {secondaryMetricLabel}
              </p>
              <p className="m-0 mt-0.5 text-sm font-semibold text-white">{secondaryMetricValue}</p>
            </div>
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {timeLabel.toUpperCase()}
              </p>
              <p
                className={`m-0 mt-0.5 text-sm font-semibold tabular-nums ${isUrgent ? "text-amber-400" : "text-white"}`}
              >
                {isSettled || status === "ended" ? "—" : getTimeLeft(timeTarget, now)}
              </p>
            </div>
          </div>
        </div>

        {/* Actions card */}
        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0a1224] p-5">
          <h3 className="m-0 text-base font-semibold text-white">Place bid</h3>

          {!connectedAddress && <AlertBox variant="info">Connect your wallet to use auction actions.</AlertBox>}

          {/* English bid */}
          {isEnglish && (
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  className={fieldClass}
                  disabled={!isActive || isSeller || isBusy}
                  inputMode="decimal"
                  min="0"
                  onChange={e => setBidAmount(e.target.value)}
                  placeholder="0.0"
                  step="any"
                  type="number"
                  value={bidAmount}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  ETH
                </span>
              </div>
              <TxButton
                className="shrink-0"
                disabled={!isActive || isSeller || !bidAmount || isBusy}
                isLoading={activeAction === "bid"}
                onClick={() =>
                  runAuctionTx("bid", "Submitting bid.", {
                    address: auctionAddress,
                    abi: englishAuctionAbi,
                    functionName: "bid",
                    value: parseEther(bidAmount || "0"),
                  } as Parameters<typeof writeContractAsync>[0] & { value: bigint })
                }
                type="button"
              >
                Bid
              </TxButton>
            </div>
          )}

          {/* Dutch buy */}
          {isDutch && (
            <TxButton
              className="w-full py-3"
              disabled={!isActive || isSeller || isBusy}
              isLoading={activeAction === "buy"}
              onClick={() =>
                runAuctionTx("buy", "Buying Dutch auction at current price.", {
                  address: auctionAddress,
                  abi: dutchAuctionAbi,
                  functionName: "buy",
                  value: price,
                } as Parameters<typeof writeContractAsync>[0] & { value: bigint })
              }
            >
              Buy for {formatEth(price)}
            </TxButton>
          )}

          {/* Vickrey */}
          {isVickrey && (
            <div className="space-y-4">
              {Boolean(isVickreyBlocked) && (
                <AlertBox variant="error">This wallet is blocked for this auction after an invalid reveal.</AlertBox>
              )}

              {isCommitPhase && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <FormFieldLabel>Private bid (ETH)</FormFieldLabel>
                      <input
                        className={fieldClass}
                        disabled={isSeller || isBusy || hasVickreyCommitment}
                        inputMode="decimal"
                        min="0"
                        onChange={e => setCommitBidAmount(e.target.value)}
                        placeholder="0.0"
                        step="any"
                        type="number"
                        value={commitBidAmount}
                      />
                    </div>
                    <div>
                      <FormFieldLabel>Deposit (ETH)</FormFieldLabel>
                      <input
                        className={fieldClass}
                        disabled={isSeller || isBusy || hasVickreyCommitment}
                        inputMode="decimal"
                        min="0"
                        onChange={e => setCommitDeposit(e.target.value)}
                        placeholder="0.0"
                        step="any"
                        type="number"
                        value={commitDeposit}
                      />
                    </div>
                  </div>
                  <div>
                    <FormFieldLabel>Secret</FormFieldLabel>
                    <div className="flex overflow-hidden rounded-xl border border-white/10 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20">
                      <input
                        className="min-w-0 flex-1 bg-[#070d1a] px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-600 outline-none disabled:opacity-50"
                        disabled={isBusy || hasVickreyCommitment}
                        onChange={e => setVickreySecret(e.target.value)}
                        placeholder="0x..."
                        value={vickreySecret}
                      />
                      <button
                        className="shrink-0 border-l border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                        disabled={isBusy || hasVickreyCommitment}
                        onClick={handleGenerateVickreySecret}
                        type="button"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                  {vickreyCommitmentHash && (
                    <div className="break-all rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300">
                      <span className="font-semibold text-slate-500">Commitment </span>
                      {vickreyCommitmentHash}
                    </div>
                  )}
                  <TxButton
                    className="w-full py-2.5"
                    disabled={!canCommitVickrey || isBusy}
                    isLoading={activeAction === "commit"}
                    onClick={() =>
                      runAuctionTx(
                        "commit",
                        "Submitting Vickrey commitment.",
                        {
                          address: auctionAddress,
                          abi: vickreyAuctionAbi,
                          functionName: "commit",
                          args: [vickreyCommitmentHash!],
                          value: parsedCommitDeposit!,
                        } as Parameters<typeof writeContractAsync>[0] & { value: bigint },
                        () =>
                          persistVickreyCommitment({
                            secret: vickreySecret,
                            bidAmount: commitBidAmount,
                            deposit: commitDeposit,
                          }),
                      )
                    }
                    type="button"
                  >
                    Commit bid
                  </TxButton>
                  <AlertBox variant="warning">
                    Save your <strong>secret</strong> and <strong>bid amount</strong> — you will need both to reveal
                    your bid in the next phase. Without them you cannot reveal, so your bid will not count.
                  </AlertBox>
                </div>
              )}

              {isRevealPhase && (
                <div className="space-y-3">
                  <div>
                    <FormFieldLabel>Bid amount (ETH)</FormFieldLabel>
                    <input
                      className={fieldClass}
                      disabled={isBusy || Boolean(userVickreyCommitment?.revealed)}
                      inputMode="decimal"
                      min="0"
                      onChange={e => setRevealBidAmount(e.target.value)}
                      placeholder="0.0"
                      step="any"
                      type="number"
                      value={revealBidAmount}
                    />
                  </div>
                  <div>
                    <FormFieldLabel>Secret</FormFieldLabel>
                    <input
                      className={fieldClass + " font-mono text-xs"}
                      disabled={isBusy || Boolean(userVickreyCommitment?.revealed)}
                      onChange={e => setVickreySecret(e.target.value)}
                      placeholder="0x..."
                      value={vickreySecret}
                    />
                  </div>
                  <TxButton
                    className="w-full py-2.5"
                    disabled={!canRevealVickrey || isBusy}
                    isLoading={activeAction === "reveal"}
                    onClick={() =>
                      runAuctionTx("reveal", "Revealing Vickrey bid.", {
                        address: auctionAddress,
                        abi: vickreyAuctionAbi,
                        functionName: "reveal",
                        args: [parsedRevealBid!, vickreySecret as `0x${string}`],
                      })
                    }
                    type="button"
                  >
                    Reveal bid
                  </TxButton>
                </div>
              )}

              {!isCommitPhase && !isRevealPhase && !hasVickreyCommitment && (
                <AlertBox variant="neutral">No commitment found for this wallet.</AlertBox>
              )}
            </div>
          )}

          {/* Secondary actions */}
          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <TxButton
              variant="secondary"
              disabled={!hasRefund || isBusy}
              isLoading={activeAction === "withdraw"}
              onClick={() =>
                runAuctionTx("withdraw", "Withdrawing refundable bid balance.", {
                  address: auctionAddress,
                  abi: auctionAbi,
                  functionName: "withdraw",
                })
              }
            >
              Withdraw{hasRefund ? ` (${formatEth(pendingReturns)})` : " refund"}
            </TxButton>
            <TxButton
              variant="secondary"
              disabled={!canFinalize || isBusy}
              isLoading={activeAction === "finalize"}
              onClick={() =>
                runAuctionTx("finalize", "Finalizing auction.", {
                  address: auctionAddress,
                  abi: auctionAbi,
                  functionName: "finalize",
                })
              }
            >
              Finalize
            </TxButton>
            <TxButton
              variant="secondary"
              disabled={!canConfirm || isBusy}
              isLoading={activeAction === "confirm"}
              onClick={() =>
                runAuctionTx("confirm", "Confirming physical item receipt.", {
                  address: auctionAddress,
                  abi: auctionAbi,
                  functionName: "confirmReceived",
                })
              }
            >
              Confirm received
            </TxButton>
          </div>

          {item.assetType === AssetType.Physical && !info.finalized && (
            <AlertBox variant="warning">
              This NFT represents a claim certificate. Delivery and identity checks happen off-chain; on-chain
              confirmation releases payment after the winner receives the physical item.
            </AlertBox>
          )}

          {item.assetType === AssetType.Physical &&
            info.finalized &&
            !isZeroAddress(info.winner) &&
            !info.receivedConfirmed &&
            isSeller && (
              <AlertBox variant="warning">
                Payment is held in escrow. Once the buyer receives the physical item and clicks{" "}
                <strong>Confirm received</strong> from their wallet, funds will be released to you automatically.
              </AlertBox>
            )}

          {item.assetType === AssetType.Physical &&
            info.finalized &&
            !isZeroAddress(info.winner) &&
            !info.receivedConfirmed &&
            isWinner && (
              <AlertBox variant="success">
                You won this auction. Once you receive the physical item, click <strong>Confirm received</strong> above
                to release payment to the seller.
              </AlertBox>
            )}

          {item.assetType === AssetType.Physical && info.receivedConfirmed && (
            <AlertBox variant="neutral">Receipt confirmed — payment has been released to the seller.</AlertBox>
          )}
        </div>

        {/* ── Bid history (English only) ── */}
        {isEnglish && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1224]">
            <p className="border-b border-white/5 px-5 py-3 text-sm font-semibold text-white">Bid history</p>
            {bidHistory.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No bids placed yet.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {bidHistory.map((entry, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3">
                    <span className="flex-1 font-mono text-xs text-white">{compactAddress(entry.bidder)}</span>
                    <span className="text-xs text-slate-500">{timeAgo(entry.timestamp, now)}</span>
                    <span className="font-semibold text-emerald-400">
                      Ξ {formatEth(entry.amount).replace(" ETH", "")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default AuctionDetailPage;
