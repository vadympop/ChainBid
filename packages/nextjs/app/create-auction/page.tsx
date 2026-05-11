"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NextPage } from "next";
import { type Address, decodeEventLog, parseEther } from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { CheckCircleIcon, CubeIcon, RectangleStackIcon } from "@heroicons/react/24/outline";
import { ImageUploader } from "~~/components/chainbid/ImageUploader";
import { NftMetadataPreview } from "~~/components/chainbid/NftMetadataPreview";
import { StyledSelect } from "~~/components/chainbid/StyledSelect";
import { useChainBidWriteContract, useSiweSession } from "~~/hooks/chainbid";
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
import { getParsedError, notification } from "~~/utils/scaffold-eth";

type PhysicalItemForm = {
  title: string;
  category: string;
  description: string;
  estimatedValue: string;
  images: File[];
};

const initialPhysicalForm: PhysicalItemForm = {
  title: "",
  category: "",
  description: "",
  estimatedValue: "",
  images: [],
};

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

const erc721TransferAbi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
  },
] as const;

const auctionNftMintAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenURI_", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const StepBadge = ({ n }: { n: number }) => (
  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
    {n}
  </span>
);

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between border-t border-white/5 py-2 text-sm first:border-0 first:pt-0">
    <span className="text-slate-500">{label}</span>
    <span className="font-semibold text-white">{value}</span>
  </div>
);

const FIELD =
  "w-full rounded-xl border border-white/10 bg-[#070d1a] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50";

const auctionCreatedAbi = [
  {
    type: "event",
    name: "AuctionCreated",
    inputs: [
      { indexed: true, name: "contractAddress", type: "address" },
      { indexed: false, name: "auctionType", type: "uint8" },
      { indexed: true, name: "seller", type: "address" },
    ],
  },
] as const;

const CreateAuctionPage: NextPage = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const router = useRouter();
  const { data: factoryInfo } = useDeployedContractInfo({ contractName: "AuctionFactory" });
  const { data: nftInfo } = useDeployedContractInfo({ contractName: "AuctionNFT" });
  const { writeContractAsync: writeFactoryAsync, isMining: isCreating } = useScaffoldWriteContract({
    contractName: "AuctionFactory",
  });
  const { writeContractAsync: writeTokenAsync, isPending: isApproving } = useChainBidWriteContract();
  const { session: siweSession, isLoading: isSiweLoading, signIn: siweSignIn } = useSiweSession();
  const [form, setForm] = useState<CreateAuctionForm>(initialForm);
  const [physicalForm, setPhysicalForm] = useState<PhysicalItemForm>(initialPhysicalForm);
  const [isMintingCert, setIsMintingCert] = useState(false);
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

  const isCertMinted =
    form.assetType === "Physical" &&
    Boolean(nftInfo?.address && form.tokenContract?.toLowerCase() === nftInfo?.address.toLowerCase() && form.tokenId);

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

  const handleMintCertificate = async () => {
    if (!address || !nftInfo?.address) {
      notification.error("Connect your wallet first.");
      return;
    }
    if (!physicalForm.title || !physicalForm.description || physicalForm.images.length === 0) {
      notification.error("Fill in title, description, and upload at least one image.");
      return;
    }

    try {
      setIsMintingCert(true);

      if (!siweSession.isLoggedIn) {
        notification.info("Sign the message in your wallet to authenticate the upload.");
        const ok = await siweSignIn();
        if (!ok) return;
      }

      const uploadData = new FormData();
      uploadData.append("name", physicalForm.title);
      uploadData.append("description", physicalForm.description);
      uploadData.append("assetType", "Physical");
      if (physicalForm.category) uploadData.append("category", physicalForm.category);
      physicalForm.images.forEach(img => uploadData.append("images", img));

      notification.info("Uploading item metadata to IPFS…");
      const res = await fetch("/api/pinata/upload", { method: "POST", body: uploadData });
      const json = (await res.json()) as { metadataUri?: string; error?: string };

      if (!res.ok) {
        notification.error(json.error || "Metadata upload failed.");
        return;
      }

      const metadataUri = json.metadataUri!;

      notification.info("Minting NFT certificate…");
      const hash = await writeTokenAsync({
        address: nftInfo.address as Address,
        abi: auctionNftMintAbi,
        functionName: "mint",
        args: [address, metadataUri],
      });

      if (!hash || !publicClient) return;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let mintedTokenId: bigint | undefined;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: erc721TransferAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === "Transfer") {
            mintedTokenId = decoded.args.tokenId;
            break;
          }
        } catch {
          /* skip non-matching logs */
        }
      }

      if (mintedTokenId === undefined) {
        notification.error("Mint succeeded but could not read token ID from receipt.");
        return;
      }

      updateForm("tokenContract", nftInfo.address);
      updateForm("tokenId", mintedTokenId.toString());
      notification.success(`NFT certificate minted — Token #${mintedTokenId.toString()}`);
    } catch (error) {
      notification.error(getParsedError(error));
    } finally {
      setIsMintingCert(false);
    }
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

      let createHash: `0x${string}` | undefined;
      if (form.auctionType === "English") {
        createHash = await writeFactoryAsync({
          functionName: "createEnglishAuction",
          args: [item, reservePrice, duration],
        });
      } else if (form.auctionType === "Dutch") {
        createHash = await writeFactoryAsync({
          functionName: "createDutchAuction",
          args: [item, parseEther(form.startPrice), reservePrice, duration],
        });
      } else {
        createHash = await writeFactoryAsync({
          functionName: "createVickreyAuction",
          args: [
            item,
            reservePrice,
            secondsFromHours(form.commitDurationHours),
            secondsFromHours(form.revealDurationHours),
          ],
        });
      }

      if (!createHash || !publicClient) return;

      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      let newAuctionAddress: Address | undefined;
      for (const log of createReceipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: auctionCreatedAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === "AuctionCreated") {
            newAuctionAddress = decoded.args.contractAddress;
            break;
          }
        } catch {
          /* skip non-matching logs */
        }
      }

      notification.success(`${form.auctionType} auction created.`);

      if (newAuctionAddress) {
        router.push(`/auction/${newAuctionAddress}`);
      } else {
        setForm(current => ({ ...initialForm, tokenContract: current.tokenContract }));
      }
    } catch (error) {
      notification.error(getParsedError(error));
    }
  };

  const isPending = isApproving || isCreating || isMintingCert || isSiweLoading;
  const tokenLabel = useMemo(() => {
    if (!form.tokenContract || !form.tokenId) return undefined;
    return `${form.tokenType} ${form.tokenContract.slice(0, 6)}...${form.tokenContract.slice(-4)} / #${form.tokenId}`;
  }, [form.tokenContract, form.tokenId, form.tokenType]);

  const formatLabel =
    form.auctionType === "English"
      ? "English ascending"
      : form.auctionType === "Dutch"
        ? "Dutch descending"
        : "Vickrey sealed";

  const formatHoursOrMinutes = (hoursStr: string) => {
    const h = Number(hoursStr);
    return h < 1 ? `${Math.round(h * 60)}m` : `${hoursStr}h`;
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <form className="grid gap-5 lg:grid-cols-[1fr_320px]" onSubmit={handleSubmit}>
        {/* ── Main column ── */}
        <div className="space-y-4">
          {/* Item-type selector */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                id: "Digital" as const,
                label: "On-chain NFT",
                desc: "Existing token in your wallet — list directly from contract.",
                Icon: CubeIcon,
              },
              {
                id: "Physical" as const,
                label: "Physical item",
                desc: "We mint an NFT certificate that represents the item; we hold custody and ship to winner.",
                Icon: RectangleStackIcon,
              },
            ].map(({ id, label, desc, Icon }) => {
              const active = form.assetType === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={isPending || (id === "Digital" && shouldLockAssetType)}
                  onClick={() => {
                    if (!shouldLockAssetType) {
                      updateForm("assetType", id);
                      if (id === "Digital") {
                        updateForm("tokenContract", "");
                        updateForm("tokenId", "");
                        setPhysicalForm(initialPhysicalForm);
                      }
                    }
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    active ? "border-blue-500 bg-blue-600/10" : "border-white/10 bg-[#0a1224] hover:border-white/20"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-blue-600" : "bg-white/5"}`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />
                    </span>
                    <span className="font-semibold text-white">{label}</span>
                    {active && <CheckCircleIcon className="ml-auto h-5 w-5 shrink-0 text-blue-400" />}
                  </div>
                  <p className="m-0 text-xs text-slate-400">{desc}</p>
                </button>
              );
            })}
          </div>
          {shouldLockAssetType && (
            <p className="text-xs text-slate-500">Asset type matched from ChainBid item metadata.</p>
          )}

          {/* Step 1 */}
          <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0a1224] p-5">
            <div className="flex items-center gap-3">
              <StepBadge n={1} />
              <h3 className="m-0 text-base font-semibold text-white">
                {form.assetType === "Physical" ? "Item details & certificate" : "Select token"}
              </h3>
            </div>

            {form.assetType === "Physical" ? (
              /* ── Physical item form ── */
              <>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs leading-relaxed text-blue-200">
                  ChainBid mints an ERC-721 certificate representing your item. The NFT is used as the auction lot — the
                  winner receives custody transfer and shipping.
                </div>

                {isCertMinted ? (
                  /* Certificate minted — show summary */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                      <CheckCircleIcon className="h-5 w-5 shrink-0" />
                      NFT certificate minted
                    </div>
                    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/5 text-sm">
                      <div className="bg-black/30 px-3 py-2">
                        <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                          Contract
                        </p>
                        <p className="m-0 mt-1 font-mono text-xs text-white">
                          {form.tokenContract.slice(0, 8)}…{form.tokenContract.slice(-6)}
                        </p>
                      </div>
                      <div className="bg-black/30 px-3 py-2">
                        <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                          Token ID
                        </p>
                        <p className="m-0 mt-1 font-mono text-xs text-white">#{form.tokenId}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-slate-500 underline hover:text-white"
                      onClick={() => {
                        updateForm("tokenContract", "");
                        updateForm("tokenId", "");
                        setPhysicalForm(initialPhysicalForm);
                      }}
                    >
                      Mint a different certificate
                    </button>
                  </div>
                ) : (
                  /* Physical item metadata form */
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                          Item title
                        </p>
                        <input
                          className={FIELD}
                          disabled={isMintingCert}
                          onChange={e => setPhysicalForm(f => ({ ...f, title: e.target.value }))}
                          placeholder="e.g. Vintage Rolex Submariner"
                          value={physicalForm.title}
                        />
                      </div>
                      <div>
                        <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                          Category
                        </p>
                        <StyledSelect
                          className={FIELD}
                          disabled={isMintingCert}
                          onChange={e => setPhysicalForm(f => ({ ...f, category: e.target.value }))}
                          options={[
                            "Art",
                            "Collectibles",
                            "Electronics",
                            "Fashion",
                            "Jewelry",
                            "Sports",
                            "Watches",
                            "Other",
                          ]}
                          placeholder="Select category"
                          value={physicalForm.category}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                        Description
                      </p>
                      <textarea
                        className={FIELD + " min-h-24 resize-none"}
                        disabled={isMintingCert}
                        onChange={e => setPhysicalForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Describe the item — condition, history, notable features…"
                        rows={3}
                        value={physicalForm.description}
                      />
                    </div>

                    <div>
                      <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                        Estimated value (USD)
                      </p>
                      <input
                        className={FIELD}
                        disabled={isMintingCert}
                        inputMode="decimal"
                        min="0"
                        onChange={e => setPhysicalForm(f => ({ ...f, estimatedValue: e.target.value }))}
                        placeholder="0.00"
                        step="any"
                        type="number"
                        value={physicalForm.estimatedValue}
                      />
                    </div>

                    <div>
                      <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                        Photos
                      </p>
                      <ImageUploader
                        disabled={isMintingCert}
                        files={physicalForm.images}
                        onChange={images => setPhysicalForm(f => ({ ...f, images }))}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={
                        isMintingCert ||
                        !physicalForm.title ||
                        !physicalForm.description ||
                        physicalForm.images.length === 0
                      }
                      onClick={handleMintCertificate}
                      className="w-full rounded-xl border border-blue-500/30 bg-blue-600/10 py-3 text-sm font-bold text-blue-300 transition hover:bg-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isMintingCert ? "Minting certificate…" : "Mint NFT certificate"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* ── Digital NFT fields ── */
              <>
                {/* Token standard */}
                <div>
                  <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Token standard
                  </p>
                  <div className="flex gap-2">
                    {(["ERC721", "ERC1155"] as const).map(std => (
                      <button
                        key={std}
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          setForm(current => ({
                            ...current,
                            amount: std === "ERC721" ? "1" : current.amount,
                            tokenType: std,
                          }))
                        }
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                          form.tokenType === std
                            ? "bg-blue-600 text-white"
                            : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {std === "ERC721" ? "ERC-721" : "ERC-1155"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Token contract */}
                <div>
                  <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Token contract
                  </p>
                  <div className="flex overflow-hidden rounded-xl border border-white/10 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20">
                    <input
                      className="min-w-0 flex-1 bg-[#070d1a] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none disabled:opacity-50"
                      disabled={isPending}
                      onChange={event => updateForm("tokenContract", event.target.value)}
                      placeholder="0x..."
                      value={form.tokenContract}
                    />
                    <button
                      className="shrink-0 border-l border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                      disabled={!nftInfo?.address || isPending}
                      onClick={usePlatformNft}
                      type="button"
                    >
                      AuctionNFT
                    </button>
                  </div>
                </div>

                {/* Token ID + Amount */}
                <div className={form.tokenType === "ERC1155" ? "grid gap-3 sm:grid-cols-2" : ""}>
                  <div>
                    <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                      Token ID
                    </p>
                    <input
                      className={FIELD}
                      disabled={isPending}
                      inputMode="numeric"
                      min="0"
                      onChange={event => updateForm("tokenId", event.target.value)}
                      placeholder="0"
                      step="1"
                      type="number"
                      value={form.tokenId}
                    />
                  </div>
                  {form.tokenType === "ERC1155" && (
                    <div>
                      <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                        Amount
                      </p>
                      <input
                        className={FIELD}
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
                        <p className="m-0 mt-1 text-xs text-slate-500">Available: {erc1155Balance.toString()}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Contract + Token ID info strip */}
                {form.tokenContract && form.tokenId && (
                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/5 text-sm">
                    <div className="bg-black/30 px-3 py-2">
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Contract</p>
                      <p className="m-0 mt-1 font-mono text-xs text-white">
                        {form.tokenContract.slice(0, 8)}…{form.tokenContract.slice(-6)}
                      </p>
                    </div>
                    <div className="bg-black/30 px-3 py-2">
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Token ID</p>
                      <p className="m-0 mt-1 font-mono text-xs text-white">#{form.tokenId}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Step 2: Auction format */}
          <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0a1224] p-5">
            <div className="flex items-center gap-3">
              <StepBadge n={2} />
              <h3 className="m-0 text-base font-semibold text-white">Auction format</h3>
            </div>

            {/* Format cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  { type: "English", title: "English ascending", desc: "Bids rise; highest at close wins." },
                  { type: "Dutch", title: "Dutch descending", desc: "Price falls until accepted. First buyer wins." },
                  { type: "Vickrey", title: "Vickrey sealed", desc: "Sealed bids; second-highest price wins." },
                ] as const
              ).map(({ type, title, desc }) => {
                const active = form.auctionType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={isPending}
                    onClick={() => updateForm("auctionType", type)}
                    className={`rounded-xl border p-4 text-left transition ${
                      active ? "border-blue-500 bg-blue-600/10" : "border-white/10 bg-black/30 hover:border-white/20"
                    }`}
                  >
                    <p className={`m-0 text-sm font-bold ${active ? "text-white" : "text-slate-300"}`}>{title}</p>
                    <p className="m-0 mt-1 text-xs text-slate-500">{desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Pricing */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Reserve (Ξ)
                </p>
                <input
                  className={FIELD}
                  disabled={isPending}
                  inputMode="decimal"
                  min="0"
                  onChange={event => updateForm("reservePrice", event.target.value)}
                  placeholder="0.0"
                  step="any"
                  type="number"
                  value={form.reservePrice}
                />
              </div>
              {form.auctionType === "Dutch" && (
                <div>
                  <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Start price (Ξ)
                  </p>
                  <input
                    className={FIELD}
                    disabled={isPending}
                    inputMode="decimal"
                    min="0"
                    onChange={event => updateForm("startPrice", event.target.value)}
                    placeholder="0.0"
                    step="any"
                    type="number"
                    value={form.startPrice}
                  />
                  <p className="m-0 mt-1 text-xs text-slate-500">Must be ≥ reserve price.</p>
                </div>
              )}
            </div>

            {/* Duration slider (English / Dutch) */}
            {form.auctionType !== "Vickrey" && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="m-0 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Duration</p>
                  <div className="flex items-center gap-1.5">
                    <input
                      className="w-20 rounded-xl border border-white/10 bg-[#070d1a] px-2 py-1.5 text-right text-sm text-white outline-none transition focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50"
                      disabled={isPending}
                      inputMode="decimal"
                      min="0.17"
                      max="168"
                      step="0.01"
                      type="number"
                      onChange={event => updateForm("durationHours", event.target.value)}
                      value={form.durationHours}
                    />
                    <span className="text-xs text-slate-500">h</span>
                  </div>
                </div>
                <input
                  className="mt-2 w-full accent-blue-600"
                  disabled={isPending}
                  max="168"
                  min="0.17"
                  step="0.01"
                  type="range"
                  onChange={event => updateForm("durationHours", event.target.value)}
                  value={form.durationHours}
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-600">
                  <span>10m</span>
                  <span>72h</span>
                  <span>1w</span>
                </div>
              </div>
            )}

            {/* Vickrey commit / reveal durations */}
            {form.auctionType === "Vickrey" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Commit duration (h)
                  </p>
                  <input
                    className={FIELD}
                    disabled={isPending}
                    inputMode="decimal"
                    min="0.17"
                    onChange={event => updateForm("commitDurationHours", event.target.value)}
                    step="any"
                    type="number"
                    value={form.commitDurationHours}
                  />
                </div>
                <div>
                  <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Reveal duration (h)
                  </p>
                  <input
                    className={FIELD}
                    disabled={isPending}
                    inputMode="decimal"
                    min="0.17"
                    onChange={event => updateForm("revealDurationHours", event.target.value)}
                    step="any"
                    type="number"
                    value={form.revealDurationHours}
                  />
                </div>
              </div>
            )}

            {form.tokenType === "ERC1155" && !isErc1155ApprovedForFactory && form.assetType === "Digital" && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                Creating this auction will ask your wallet for collection permission so ChainBid can transfer the
                selected tokens into escrow.
              </div>
            )}
          </section>
        </div>

        {/* ── Right sidebar ── */}
        <aside className="space-y-4">
          {/* Summary */}
          <div className="rounded-2xl border border-white/10 bg-[#0a1224] p-5">
            <p className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Summary</p>
            <SummaryRow label="Type" value={form.assetType === "Physical" ? "Physical item" : "On-chain NFT"} />
            <SummaryRow label="Format" value={formatLabel} />
            {form.auctionType !== "Vickrey" ? (
              <SummaryRow label="Duration" value={formatHoursOrMinutes(form.durationHours)} />
            ) : (
              <SummaryRow
                label="Commit / Reveal"
                value={`${formatHoursOrMinutes(form.commitDurationHours)} / ${formatHoursOrMinutes(form.revealDurationHours)}`}
              />
            )}
            {form.assetType === "Digital" && <SummaryRow label="Token standard" value={form.tokenType} />}
          </div>

          {/* NFT preview */}
          <NftMetadataPreview
            isLoading={isErc721TokenUriLoading || isErc1155TokenUriLoading || isMetadataLoading}
            metadata={metadata}
            tokenLabel={tokenLabel}
          />

          {/* Factory */}
          <div className="rounded-2xl border border-white/10 bg-[#0a1224] px-4 py-3">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">AuctionFactory</p>
            <p className="m-0 mt-1 break-all font-mono text-xs text-white">{factoryInfo?.address || "Not deployed"}</p>
          </div>

          {/* CTA */}
          <button
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-sm font-bold text-white transition hover:from-blue-500 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPending || (form.assetType === "Physical" && !isCertMinted)}
            type="submit"
          >
            {isPending ? "Submitting…" : "Sign & list"}
          </button>
          {form.assetType === "Physical" && !isCertMinted ? (
            <p className="m-0 text-center text-xs text-slate-500">Mint the NFT certificate in Step 1 first.</p>
          ) : (
            <p className="m-0 text-center text-xs text-slate-500">Approves transfer + creates listing on chain.</p>
          )}
        </aside>
      </form>
    </div>
  );
};

export default CreateAuctionPage;
