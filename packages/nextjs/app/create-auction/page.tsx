"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { type Address, parseEther } from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { NftMetadataPreview } from "~~/components/chainbid/NftMetadataPreview";
import { PriceInput } from "~~/components/chainbid/PriceInput";
import { useChainBidWriteContract } from "~~/hooks/chainbid";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { AssetType, CreateAuctionForm, TokenType } from "~~/types/chainbid";
import type { ChainBidMetadata } from "~~/types/chainbid";
import { erc721Abi, erc1155Abi } from "~~/utils/chainbid/abis";
import {
  MIN_AUCTION_DURATION_SECONDS,
  buildAuctionItem,
  parseTokenAmountInput,
  parseTokenIdInput,
  secondsFromHours,
  validateTokenAddress,
} from "~~/utils/chainbid/auction";
import { fetchChainBidMetadata, getMetadataAssetType } from "~~/utils/chainbid/ipfs";
import { chainBidFieldClass } from "~~/utils/chainbid/styles";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const initialForm: CreateAuctionForm = {
  auctionType: "English",
  assetType: "Digital",
  tokenType: "ERC721",
  tokenContract: "",
  tokenId: "",
  amount: "1",
  reservePrice: "",
  startPrice: "",
  durationHours: "1",
  commitDurationHours: "1",
  revealDurationHours: "1",
};

const validateForm = (form: CreateAuctionForm, address?: string, factoryAddress?: string) => {
  if (!address) return "Connect your wallet before creating an auction.";
  if (!factoryAddress) return "AuctionFactory is not deployed.";
  if (!validateTokenAddress(form.tokenContract)) return "Enter a valid token contract address.";
  if (parseTokenIdInput(form.tokenId) === undefined) return "Enter a valid token ID.";
  if (form.tokenType === "ERC1155" && parseTokenAmountInput(form.amount) === undefined) {
    return "ERC-1155 amount must be a positive whole number.";
  }
  if (!form.reservePrice || Number(form.reservePrice) <= 0) return "Reserve price must be greater than zero.";
  if (form.auctionType === "Dutch") {
    if (!form.startPrice || Number(form.startPrice) <= 0) return "Dutch start price must be greater than zero.";
    if (Number(form.startPrice) < Number(form.reservePrice))
      return "Dutch start price must be at least the reserve price.";
  }
  if (
    form.auctionType === "Vickrey" &&
    secondsFromHours(form.commitDurationHours) < BigInt(MIN_AUCTION_DURATION_SECONDS)
  ) {
    return "Commit duration must be at least 10 minutes.";
  }
  if (
    form.auctionType === "Vickrey" &&
    secondsFromHours(form.revealDurationHours) < BigInt(MIN_AUCTION_DURATION_SECONDS)
  ) {
    return "Reveal duration must be at least 10 minutes.";
  }
  if (form.auctionType !== "Vickrey" && secondsFromHours(form.durationHours) < BigInt(MIN_AUCTION_DURATION_SECONDS)) {
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
  const { writeContractAsync: writeTokenAsync, isPending: isApproving } = useChainBidWriteContract();
  const [form, setForm] = useState<CreateAuctionForm>(initialForm);
  const [metadata, setMetadata] = useState<ChainBidMetadata>();
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);

  const tokenAddress = validateTokenAddress(form.tokenContract) ? (form.tokenContract as Address) : undefined;
  const parsedTokenId = parseTokenIdInput(form.tokenId);
  const parsedAmount = form.tokenType === "ERC1155" ? parseTokenAmountInput(form.amount) : 1n;
  const tokenId = parsedTokenId || 0n;
  const metadataAssetType = getMetadataAssetType(metadata);
  const isPlatformAuctionNft =
    Boolean(nftInfo?.address && tokenAddress) && tokenAddress?.toLowerCase() === nftInfo?.address.toLowerCase();
  const shouldLockAssetType =
    isPlatformAuctionNft && (metadataAssetType === "Digital" || metadataAssetType === "Physical");

  const { data: erc721TokenUri, isLoading: isErc721TokenUriLoading } = useReadContract({
    address: tokenAddress,
    abi: erc721Abi,
    functionName: "tokenURI",
    args: [tokenId],
    query: { enabled: Boolean(tokenAddress && form.tokenId && form.tokenType === "ERC721") },
  });
  const { data: erc1155TokenUri, isLoading: isErc1155TokenUriLoading } = useReadContract({
    address: tokenAddress,
    abi: erc1155Abi,
    functionName: "uri",
    args: [tokenId],
    query: { enabled: Boolean(tokenAddress && form.tokenId && form.tokenType === "ERC1155") },
  });
  const { data: erc1155Balance } = useReadContract({
    address: tokenAddress,
    abi: erc1155Abi,
    functionName: "balanceOf",
    args: [address || "0x0000000000000000000000000000000000000000", tokenId],
    query: { enabled: Boolean(address && tokenAddress && form.tokenId && form.tokenType === "ERC1155") },
  });
  const { data: isErc1155ApprovedForFactory } = useReadContract({
    address: tokenAddress,
    abi: erc1155Abi,
    functionName: "isApprovedForAll",
    args: [
      address || "0x0000000000000000000000000000000000000000",
      factoryInfo?.address || "0x0000000000000000000000000000000000000000",
    ],
    query: { enabled: Boolean(address && tokenAddress && factoryInfo?.address && form.tokenType === "ERC1155") },
  });

  const tokenUri = erc721TokenUri || erc1155TokenUri;

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

  useEffect(() => {
    if (metadataAssetType === "Digital" || metadataAssetType === "Physical") {
      updateForm("assetType", metadataAssetType);
    }
  }, [metadataAssetType]);

  const updateForm = <K extends keyof CreateAuctionForm>(key: K, value: CreateAuctionForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const usePlatformNft = () => {
    if (!nftInfo?.address) return;

    setForm(current => ({
      ...current,
      amount: "1",
      tokenContract: nftInfo.address,
      tokenType: "ERC721",
    }));
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
      if (form.tokenType === "ERC1155" && erc1155Balance !== undefined && parsedAmount! > erc1155Balance) {
        notification.error(`You only own ${erc1155Balance.toString()} of this ERC-1155 token.`);
        return;
      }

      const reservePrice = parseEther(form.reservePrice);
      const duration = secondsFromHours(form.durationHours);
      const item = buildAuctionItem({
        assetType: form.assetType === "Digital" ? AssetType.Digital : AssetType.Physical,
        metadataURI: typeof tokenUri === "string" ? tokenUri : "",
        tokenType: form.tokenType === "ERC721" ? TokenType.ERC721 : TokenType.ERC1155,
        tokenContract: form.tokenContract as Address,
        tokenId: parsedTokenId!,
        amount: parsedAmount!,
      });

      if (form.tokenType === "ERC1155" && isErc1155ApprovedForFactory) {
        notification.info("Factory already has permission for this collection. Creating auction.");
      } else {
        notification.info("Approving AuctionFactory to escrow this NFT.");
        const approvalHash =
          form.tokenType === "ERC721"
            ? await writeTokenAsync({
                address: form.tokenContract as Address,
                abi: erc721Abi,
                functionName: "approve",
                args: [factoryAddress!, parsedTokenId!],
              })
            : await writeTokenAsync({
                address: form.tokenContract as Address,
                abi: erc1155Abi,
                functionName: "setApprovalForAll",
                args: [factoryAddress!, true],
              });

        if (approvalHash && publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approvalHash });
        }
        if (!approvalHash) return;

        notification.success("Factory approved. Creating auction.");
      }

      if (form.auctionType === "English") {
        await writeFactoryAsync({
          functionName: "createEnglishAuction",
          args: [item, reservePrice, duration],
        });
      } else if (form.auctionType === "Dutch") {
        await writeFactoryAsync({
          functionName: "createDutchAuction",
          args: [item, parseEther(form.startPrice), reservePrice, duration],
        });
      } else {
        await writeFactoryAsync({
          functionName: "createVickreyAuction",
          args: [
            item,
            reservePrice,
            secondsFromHours(form.commitDurationHours),
            secondsFromHours(form.revealDurationHours),
          ],
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
    return `${form.tokenType} ${form.tokenContract.slice(0, 6)}...${form.tokenContract.slice(-4)} / #${form.tokenId}`;
  }, [form.tokenContract, form.tokenId, form.tokenType]);

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
                <option>Vickrey</option>
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-slate-300">Asset type</span>
              <select
                className={`select select-bordered border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
                disabled={isPending || shouldLockAssetType}
                onChange={event => updateForm("assetType", event.target.value as CreateAuctionForm["assetType"])}
                value={form.assetType}
              >
                <option>Digital</option>
                <option>Physical</option>
              </select>
              {shouldLockAssetType && (
                <span className="label-text-alt mt-1 text-slate-500">Matched from this ChainBid item metadata.</span>
              )}
            </label>
          </div>

          <label className="form-control">
            <span className="label-text text-slate-300">Token standard</span>
            <select
              className={`select select-bordered border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
              disabled={isPending}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  amount: event.target.value === "ERC721" ? "1" : current.amount,
                  tokenType: event.target.value as CreateAuctionForm["tokenType"],
                }))
              }
              value={form.tokenType}
            >
              <option value="ERC721">ERC-721</option>
              <option value="ERC1155">ERC-1155</option>
            </select>
          </label>

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

          <div className={form.tokenType === "ERC1155" ? "grid gap-4 sm:grid-cols-2" : ""}>
            <label className="form-control">
              <span className="label-text text-slate-300">Token ID</span>
              <input
                className={`input input-bordered border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
                disabled={isPending}
                inputMode="numeric"
                min="0"
                onChange={event => updateForm("tokenId", event.target.value)}
                placeholder="0"
                step="1"
                type="number"
                value={form.tokenId}
              />
            </label>

            {form.tokenType === "ERC1155" && (
              <label className="form-control">
                <span className="label-text text-slate-300">Amount</span>
                <input
                  className={`input input-bordered border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
                  disabled={isPending}
                  inputMode="numeric"
                  min="1"
                  onChange={event => updateForm("amount", event.target.value)}
                  placeholder="1"
                  step="1"
                  type="number"
                  value={form.amount}
                />
                {erc1155Balance !== undefined && (
                  <span className="label-text-alt mt-1 text-slate-500">
                    Available in your wallet: {erc1155Balance.toString()}
                  </span>
                )}
              </label>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PriceInput
              disabled={isPending}
              label="Reserve price"
              onChange={value => updateForm("reservePrice", value)}
              value={form.reservePrice}
            />
            {form.auctionType !== "Vickrey" && (
              <label className="form-control">
                <span className="label-text text-slate-300">Duration</span>
                <div className="join w-full">
                  <input
                    className={`input join-item input-bordered w-full border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
                    disabled={isPending}
                    inputMode="decimal"
                    min="0.17"
                    onChange={event => updateForm("durationHours", event.target.value)}
                    step="any"
                    type="number"
                    value={form.durationHours}
                  />
                  <span className="join-item flex items-center border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-300">
                    hours
                  </span>
                </div>
              </label>
            )}
          </div>

          {form.auctionType === "Vickrey" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-control">
                <span className="label-text text-slate-300">Commit duration</span>
                <div className="join w-full">
                  <input
                    className={`input join-item input-bordered w-full border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
                    disabled={isPending}
                    inputMode="decimal"
                    min="0.17"
                    onChange={event => updateForm("commitDurationHours", event.target.value)}
                    step="any"
                    type="number"
                    value={form.commitDurationHours}
                  />
                  <span className="join-item flex items-center border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-300">
                    hours
                  </span>
                </div>
              </label>
              <label className="form-control">
                <span className="label-text text-slate-300">Reveal duration</span>
                <div className="join w-full">
                  <input
                    className={`input join-item input-bordered w-full border-white/10 bg-slate-950/70 text-white ${chainBidFieldClass}`}
                    disabled={isPending}
                    inputMode="decimal"
                    min="0.17"
                    onChange={event => updateForm("revealDurationHours", event.target.value)}
                    step="any"
                    type="number"
                    value={form.revealDurationHours}
                  />
                  <span className="join-item flex items-center border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-300">
                    hours
                  </span>
                </div>
              </label>
            </div>
          )}

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
            isLoading={isErc721TokenUriLoading || isErc1155TokenUriLoading || isMetadataLoading}
            metadata={metadata}
            tokenLabel={tokenLabel}
          />
          {form.tokenType === "ERC1155" && !isErc1155ApprovedForFactory && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              Creating this auction will ask your wallet for collection permission so ChainBid can transfer the selected
              tokens into escrow.
            </div>
          )}
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
