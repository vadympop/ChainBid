"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { NextPage } from "next";
import { type Address, isAddress, parseEther } from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { AuctionStatusBadge } from "~~/components/chainbid/AuctionStatusBadge";
import { NftMetadataPreview } from "~~/components/chainbid/NftMetadataPreview";
import { PriceInput } from "~~/components/chainbid/PriceInput";
import { useAuctionNow } from "~~/components/chainbid/useAuctionNow";
import { useChainBidWriteContract } from "~~/hooks/chainbid";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { AssetType, AuctionType, TokenType } from "~~/types/chainbid";
import type { AuctionRecord, ChainBidMetadata, DutchAuctionInfo, EnglishAuctionInfo } from "~~/types/chainbid";
import { dutchAuctionAbi, englishAuctionAbi, erc721Abi, erc1155Abi } from "~~/utils/chainbid/abis";
import {
  AUCTION_REFRESH_INTERVAL_MS,
  TOKEN_TYPE_LABELS,
  compactAddress,
  formatEth,
  getAuctionStatus,
  getDutchPrice,
  getEnglishPrice,
  getTimeLeft,
  isZeroAddress,
  normalizeAuctionItem,
} from "~~/utils/chainbid/auction";
import { fetchChainBidMetadata } from "~~/utils/chainbid/ipfs";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="m-0 mt-2 break-all text-sm font-semibold text-white">{value}</p>
  </div>
);

const AuctionDetailPage: NextPage = () => {
  const params = useParams<{ address: string }>();
  const auctionAddress = params.address && isAddress(params.address) ? (params.address as Address) : undefined;
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useChainBidWriteContract();
  const now = useAuctionNow();
  const [bidAmount, setBidAmount] = useState("");
  const [metadata, setMetadata] = useState<ChainBidMetadata>();
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);

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
  const auctionAbi = isDutch ? dutchAuctionAbi : englishAuctionAbi;

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

  const info = (isEnglish ? englishInfo : dutchInfo) as EnglishAuctionInfo | DutchAuctionInfo | undefined;
  const item = useMemo(() => (info ? normalizeAuctionItem(info.item) : undefined), [info]);

  const { data: pendingReturns } = useReadContract({
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

  useEffect(() => {
    if (!tokenUri || !item) return;

    let ignore = false;
    setIsMetadataLoading(true);
    fetchChainBidMetadata(tokenUri, { contractAddress: item.tokenContract, tokenId: item.tokenId }).then(result => {
      if (!ignore) {
        setMetadata(result);
        setIsMetadataLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [item, tokenUri]);

  const refetchInfo = async () => {
    if (isEnglish) await refetchEnglish();
    if (isDutch) {
      await refetchDutch();
      await refetchDutchCurrentPrice();
    }
  };

  const runAuctionTx = async (
    label: string,
    request: Parameters<typeof writeContractAsync>[0] & { value?: bigint },
  ) => {
    if (!auctionAddress) return;

    try {
      notification.info(label);
      const hash = await writeContractAsync(request);
      if (!hash) return;
      if (hash && publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      notification.success("Transaction confirmed.");
      await refetchInfo();
    } catch (error) {
      notification.error(getParsedError(error));
    }
  };

  if (!auctionAddress) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center">
        <h2 className="m-0 text-xl font-semibold text-white">Invalid auction address</h2>
        <Link href="/" className="btn mt-5 rounded-lg bg-blue-600 text-white">
          Back to marketplace
        </Link>
      </div>
    );
  }

  if (!info || !item) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8">
        <NftMetadataPreview isLoading />
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="skeleton h-8 w-1/2 rounded bg-white/10" />
          <div className="mt-5 h-24 rounded bg-white/10" />
        </div>
      </div>
    );
  }

  const status = getAuctionStatus(
    info.endTime,
    info.finalized,
    item.assetType,
    info.winner,
    info.receivedConfirmed,
    now,
  );
  const isSeller = connectedAddress?.toLowerCase() === info.seller.toLowerCase();
  const isWinner = connectedAddress?.toLowerCase() === info.winner.toLowerCase();
  const isActive = status === "active";
  const isEnded = status === "ended";
  const price = isEnglish
    ? getEnglishPrice(info as EnglishAuctionInfo)
    : (info as DutchAuctionInfo).finalized
      ? getDutchPrice(info as DutchAuctionInfo)
      : (dutchCurrentPrice ?? getDutchPrice(info as DutchAuctionInfo));
  const canFinalize = isEnded && !info.finalized;
  const canConfirm = item.assetType === AssetType.Physical && info.finalized && isWinner && !info.receivedConfirmed;
  const hasRefund = (pendingReturns || 0n) > 0n;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8">
      <aside className="space-y-4">
        <NftMetadataPreview isLoading={isMetadataLoading} metadata={metadata} tokenLabel={`Token #${item.tokenId}`} />
        <div className="grid grid-cols-2 gap-3">
          <DetailRow label="Seller" value={compactAddress(info.seller)} />
          <DetailRow label="Winner" value={isZeroAddress(info.winner) ? "None" : compactAddress(info.winner)} />
          <DetailRow label="Token standard" value={TOKEN_TYPE_LABELS[item.tokenType]} />
          <DetailRow label="Amount" value={item.amount.toString()} />
        </div>
      </aside>

      <section className="space-y-5">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap gap-2">
            <AuctionStatusBadge kind="auction" auctionType={isDutch ? AuctionType.Dutch : AuctionType.English} />
            <AuctionStatusBadge kind="asset" assetType={item.assetType} />
            <AuctionStatusBadge kind="status" status={status} />
          </div>
          <h2 className="m-0 mt-4 text-2xl font-semibold text-white">{metadata?.name || `Token #${item.tokenId}`}</h2>
          <p className="m-0 mt-2 text-sm leading-6 text-slate-400">
            {metadata?.description || "NFT-backed auction on ChainBid."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <DetailRow label={isEnglish ? "Current bid" : "Current price"} value={formatEth(price)} />
          <DetailRow label="Reserve" value={formatEth(info.reservePrice)} />
          <DetailRow label="Time left" value={getTimeLeft(info.endTime, now)} />
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h3 className="m-0 text-lg font-semibold text-white">Actions</h3>
          {!connectedAddress && (
            <p className="m-0 mt-3 rounded-lg border border-blue-400/20 bg-blue-500/10 p-3 text-sm text-blue-100">
              Connect your wallet to use auction actions.
            </p>
          )}

          {isEnglish ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <PriceInput
                disabled={!isActive || isSeller || isPending}
                label="Bid amount"
                onChange={setBidAmount}
                value={bidAmount}
              />
              <button
                className="btn self-end rounded-lg bg-blue-600 text-white"
                disabled={!isActive || isSeller || !bidAmount || isPending}
                onClick={() =>
                  runAuctionTx("Submitting bid.", {
                    address: auctionAddress,
                    abi: englishAuctionAbi,
                    functionName: "bid",
                    value: parseEther(bidAmount || "0"),
                  } as Parameters<typeof writeContractAsync>[0] & { value: bigint })
                }
                type="button"
              >
                Bid
              </button>
            </div>
          ) : (
            <button
              className="btn mt-4 rounded-lg bg-blue-600 text-white"
              disabled={!isActive || isSeller || isPending}
              onClick={() =>
                runAuctionTx("Buying Dutch auction at current price.", {
                  address: auctionAddress,
                  abi: dutchAuctionAbi,
                  functionName: "buy",
                  value: price,
                } as Parameters<typeof writeContractAsync>[0] & { value: bigint })
              }
              type="button"
            >
              Buy for {formatEth(price)}
            </button>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="btn rounded-lg border-white/10 bg-white/[0.06] text-slate-200"
              disabled={!hasRefund || isPending}
              onClick={() =>
                runAuctionTx("Withdrawing refundable bid balance.", {
                  address: auctionAddress,
                  abi: auctionAbi,
                  functionName: "withdraw",
                })
              }
              type="button"
            >
              Withdraw refund {hasRefund ? `(${formatEth(pendingReturns)})` : ""}
            </button>
            <button
              className="btn rounded-lg border-white/10 bg-white/[0.06] text-slate-200"
              disabled={!canFinalize || isPending}
              onClick={() =>
                runAuctionTx("Finalizing auction.", {
                  address: auctionAddress,
                  abi: isDutch ? dutchAuctionAbi : englishAuctionAbi,
                  functionName: "finalize",
                })
              }
              type="button"
            >
              Finalize
            </button>
            <button
              className="btn rounded-lg border-white/10 bg-white/[0.06] text-slate-200"
              disabled={!canConfirm || isPending}
              onClick={() =>
                runAuctionTx("Confirming physical item receipt.", {
                  address: auctionAddress,
                  abi: isDutch ? dutchAuctionAbi : englishAuctionAbi,
                  functionName: "confirmReceived",
                })
              }
              type="button"
            >
              Confirm received
            </button>
          </div>

          {item.assetType === AssetType.Physical && (
            <p className="m-0 mt-4 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
              This NFT represents a claim certificate. Delivery and identity checks happen off-chain; on-chain
              confirmation releases payment after the winner receives the physical item.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default AuctionDetailPage;
