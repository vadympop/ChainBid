"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { type Address, parseEther } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { NftMetadataPreview } from "~~/components/chainbid/NftMetadataPreview";
import { PriceInput } from "~~/components/chainbid/PriceInput";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { AssetType, CreateAuctionForm } from "~~/types/chainbid";
import type { ChainBidMetadata } from "~~/types/chainbid";
import { erc721Abi } from "~~/utils/chainbid/abis";
import {
  MIN_AUCTION_DURATION_SECONDS,
  buildAuctionItem,
  parseTokenIdInput,
  secondsFromHours,
  validateTokenAddress,
} from "~~/utils/chainbid/auction";
import { fetchChainBidMetadata } from "~~/utils/chainbid/ipfs";
import { chainBidFieldClass } from "~~/utils/chainbid/styles";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const initialForm: CreateAuctionForm = {
  auctionType: "English",
  assetType: "Digital",
  tokenContract: "",
  tokenId: "",
  reservePrice: "",
  startPrice: "",
  durationHours: "1",
};

const validateForm = (form: CreateAuctionForm, address?: string, factoryAddress?: string) => {
  if (!address) return "Connect your wallet before creating an auction.";
  if (!factoryAddress) return "AuctionFactory is not deployed.";
  if (!validateTokenAddress(form.tokenContract)) return "Enter a valid token contract address.";
  if (parseTokenIdInput(form.tokenId) === undefined) return "Enter a valid token ID.";
  if (!form.reservePrice || Number(form.reservePrice) <= 0) return "Reserve price must be greater than zero.";
  if (form.auctionType === "Dutch") {
    if (!form.startPrice || Number(form.startPrice) <= 0) return "Dutch start price must be greater than zero.";
    if (Number(form.startPrice) < Number(form.reservePrice))
      return "Dutch start price must be at least the reserve price.";
  }
  if (secondsFromHours(form.durationHours) < BigInt(MIN_AUCTION_DURATION_SECONDS)) {
    return "Duration must be at least 10 minutes.";
  }
  return "";
};

const CreateAuctionPage: NextPage = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: factoryInfo } = useDeployedContractInfo({ contractName: "AuctionFactory" });
  const { data: nftInfo } = useDeployedContractInfo({ contractName: "AuctionNFT" });
  const { writeContractAsync: writeFactoryAsync, isMining: isCreating } = useScaffoldWriteContract({
    contractName: "AuctionFactory",
  });
  const { writeContractAsync: writeTokenAsync, isPending: isApproving } = useWriteContract();
  const [form, setForm] = useState<CreateAuctionForm>(initialForm);
  const [metadata, setMetadata] = useState<ChainBidMetadata>();
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);

  const tokenAddress = validateTokenAddress(form.tokenContract) ? (form.tokenContract as Address) : undefined;
  const parsedTokenId = parseTokenIdInput(form.tokenId);
  const tokenId = parsedTokenId || 0n;

  const { data: tokenUri, isLoading: isTokenUriLoading } = useReadContract({
    address: tokenAddress,
    abi: erc721Abi,
    functionName: "tokenURI",
    args: [tokenId],
    query: { enabled: Boolean(tokenAddress && form.tokenId) },
  });

  useEffect(() => {
    if (!tokenUri || !tokenAddress || !form.tokenId) {
      setMetadata(undefined);
      return;
    }

    let ignore = false;
    setIsMetadataLoading(true);
    fetchChainBidMetadata(tokenUri, { contractAddress: tokenAddress, tokenId }).then(result => {
      if (!ignore) {
        setMetadata(result);
        setIsMetadataLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [form.tokenId, tokenAddress, tokenId, tokenUri]);

  const updateForm = <K extends keyof CreateAuctionForm>(key: K, value: CreateAuctionForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const usePlatformNft = () => {
    if (nftInfo?.address) updateForm("tokenContract", nftInfo.address);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const factoryAddress = factoryInfo?.address;
    const validationError = validateForm(form, address, factoryAddress);

    if (validationError) {
      notification.error(validationError);
      return;
    }

    try {
      const reservePrice = parseEther(form.reservePrice);
      const duration = secondsFromHours(form.durationHours);
      const item = buildAuctionItem({
        assetType: form.assetType === "Digital" ? AssetType.Digital : AssetType.Physical,
        metadataURI: typeof tokenUri === "string" ? tokenUri : "",
        tokenContract: form.tokenContract as Address,
        tokenId: parsedTokenId!,
      });

      notification.info("Approving AuctionFactory to escrow this NFT.");
      const approvalHash = await writeTokenAsync({
        address: form.tokenContract as Address,
        abi: erc721Abi,
        functionName: "approve",
        args: [factoryAddress!, parsedTokenId!],
      });

      if (approvalHash && publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }

      notification.success("Factory approved. Creating auction.");

      if (form.auctionType === "English") {
        await writeFactoryAsync({
          functionName: "createEnglishAuction",
          args: [item, reservePrice, duration],
        });
      } else {
        await writeFactoryAsync({
          functionName: "createDutchAuction",
          args: [item, parseEther(form.startPrice), reservePrice, duration],
        });
      }

      notification.success(`${form.auctionType} auction created.`);
      setForm(current => ({ ...initialForm, tokenContract: current.tokenContract }));
    } catch (error) {
      notification.error(getParsedError(error));
    }
  };

  const isPending = isApproving || isCreating;
  const tokenLabel = useMemo(() => {
    if (!form.tokenContract || !form.tokenId) return undefined;
    return `${form.tokenContract.slice(0, 6)}...${form.tokenContract.slice(-4)} / #${form.tokenId}`;
  }, [form.tokenContract, form.tokenId]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <form className="grid gap-6 lg:grid-cols-[1fr_360px]" onSubmit={handleSubmit}>
        <section className="space-y-5 rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div>
            <h2 className="m-0 text-xl font-semibold text-white">Auction terms</h2>
            <p className="m-0 mt-2 text-sm text-slate-400">
              The factory receives approval, creates the clone, and escrows the NFT into that clone.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text text-slate-300">Auction type</span>
              <select
                className={`select select-bordered border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
                disabled={isPending}
                onChange={event => updateForm("auctionType", event.target.value as CreateAuctionForm["auctionType"])}
                value={form.auctionType}
              >
                <option>English</option>
                <option>Dutch</option>
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-slate-300">Asset type</span>
              <select
                className={`select select-bordered border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
                disabled={isPending}
                onChange={event => updateForm("assetType", event.target.value as CreateAuctionForm["assetType"])}
                value={form.assetType}
              >
                <option>Digital</option>
                <option>Physical</option>
              </select>
            </label>
          </div>

          <label className="form-control">
            <span className="label-text text-slate-300">Token contract</span>
            <div className="join w-full">
              <input
                className={`input join-item input-bordered w-full border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
                disabled={isPending}
                onChange={event => updateForm("tokenContract", event.target.value)}
                placeholder="0x..."
                value={form.tokenContract}
              />
              <button
                className="btn join-item rounded-r-lg border-white/10 bg-white/[0.06] text-slate-200"
                disabled={!nftInfo?.address || isPending}
                onClick={usePlatformNft}
                type="button"
              >
                AuctionNFT
              </button>
            </div>
          </label>

          <label className="form-control">
            <span className="label-text text-slate-300">Token ID</span>
            <input
              className={`input input-bordered border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
              disabled={isPending}
              inputMode="numeric"
              min="0"
              onChange={event => updateForm("tokenId", event.target.value)}
              placeholder="0"
              type="number"
              value={form.tokenId}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <PriceInput
              disabled={isPending}
              label="Reserve price"
              onChange={value => updateForm("reservePrice", value)}
              value={form.reservePrice}
            />
            <label className="form-control">
              <span className="label-text text-slate-300">Duration</span>
              <div className="join w-full">
                <input
                  className={`input join-item input-bordered w-full border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
                  disabled={isPending}
                  inputMode="decimal"
                  min="0.17"
                  onChange={event => updateForm("durationHours", event.target.value)}
                  step="0.1"
                  type="number"
                  value={form.durationHours}
                />
                <span className="join-item flex items-center border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-300">
                  hours
                </span>
              </div>
            </label>
          </div>

          {form.auctionType === "Dutch" && (
            <PriceInput
              disabled={isPending}
              hint="Must be at least the reserve price."
              label="Dutch start price"
              onChange={value => updateForm("startPrice", value)}
              value={form.startPrice}
            />
          )}

          <button className="btn rounded-lg bg-blue-600 text-white" disabled={isPending} type="submit">
            {isPending ? "Submitting..." : "Approve factory and create auction"}
          </button>
        </section>

        <aside className="space-y-4">
          <NftMetadataPreview
            isLoading={isTokenUriLoading || isMetadataLoading}
            metadata={metadata}
            tokenLabel={tokenLabel}
          />
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <p className="m-0 text-sm text-slate-500">AuctionFactory</p>
            <p className="m-0 mt-2 break-all text-sm font-semibold text-white">
              {factoryInfo?.address || "Not deployed"}
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
};

export default CreateAuctionPage;
