"use client";

import { FormEvent, useState } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { ImageUploader } from "~~/components/chainbid/ImageUploader";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { CreateItemForm } from "~~/types/chainbid";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const initialForm: CreateItemForm = {
  title: "",
  description: "",
  assetType: "Digital",
  category: "",
  images: [],
};

const validateForm = (form: CreateItemForm, address?: string) => {
  if (!address) return "Connect your wallet before minting.";
  if (!form.title.trim()) return "Title is required.";
  if (!form.description.trim()) return "Description is required.";
  if (form.images.length === 0) return "Upload at least one image.";
  if (form.images.length > 5) return "Upload no more than five images.";
  return "";
};

const CreateItemPage: NextPage = () => {
  const { address } = useAccount();
  const { data: nftInfo } = useDeployedContractInfo({ contractName: "AuctionNFT" });
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "AuctionNFT" });
  const [form, setForm] = useState<CreateItemForm>(initialForm);
  const [isUploading, setIsUploading] = useState(false);
  const [metadataUri, setMetadataUri] = useState("");

  const updateForm = <K extends keyof CreateItemForm>(key: K, value: CreateItemForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateForm(form, address);

    if (validationError) {
      notification.error(validationError);
      return;
    }

    setIsUploading(true);
    setMetadataUri("");

    try {
      const body = new FormData();
      body.append("name", form.title.trim());
      body.append("description", form.description.trim());
      body.append("assetType", form.assetType);
      if (form.category.trim()) body.append("category", form.category.trim());
      form.images.forEach(image => body.append("images", image));

      const response = await fetch("/api/pinata/upload", { method: "POST", body });
      const result = (await response.json().catch(() => ({}))) as { metadataUri?: string; error?: string };

      if (!response.ok || !result.metadataUri) {
        throw new Error(result.error || "Unable to upload metadata.");
      }

      setMetadataUri(result.metadataUri);
      notification.success("Metadata uploaded. Confirm the mint transaction.");

      await writeContractAsync({
        functionName: "mint",
        args: [address!, result.metadataUri],
      });

      notification.success("Item NFT minted.");
      setForm(initialForm);
    } catch (error) {
      notification.error(getParsedError(error));
    } finally {
      setIsUploading(false);
    }
  };

  const isPending = isUploading || isMining;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <form className="grid gap-6 lg:grid-cols-[1fr_340px]" onSubmit={handleSubmit}>
        <section className="space-y-5 rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div>
            <h2 className="m-0 text-xl font-semibold text-white">Item metadata</h2>
            <p className="m-0 mt-2 text-sm text-slate-400">
              The API route pins images and metadata with the server-only Pinata token, then the NFT stores the metadata
              URI.
            </p>
          </div>

          <label className="form-control">
            <span className="label-text text-slate-300">Title</span>
            <input
              className="input input-bordered border-white/10 bg-slate-950/70 text-white"
              disabled={isPending}
              onChange={event => updateForm("title", event.target.value)}
              placeholder="Vintage synth sample pack"
              value={form.title}
            />
          </label>

          <label className="form-control">
            <span className="label-text text-slate-300">Description</span>
            <textarea
              className="textarea textarea-bordered min-h-32 border-white/10 bg-slate-950/70 text-white"
              disabled={isPending}
              onChange={event => updateForm("description", event.target.value)}
              placeholder="Describe the item, condition, transfer details, or delivery expectations."
              value={form.description}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text text-slate-300">Asset type</span>
              <select
                className="select select-bordered border-white/10 bg-slate-950/70 text-white"
                disabled={isPending}
                onChange={event => updateForm("assetType", event.target.value as CreateItemForm["assetType"])}
                value={form.assetType}
              >
                <option>Digital</option>
                <option>Physical</option>
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-slate-300">Category</span>
              <input
                className="input input-bordered border-white/10 bg-slate-950/70 text-white"
                disabled={isPending}
                onChange={event => updateForm("category", event.target.value)}
                placeholder="Art, collectibles, music"
                value={form.category}
              />
            </label>
          </div>

          <ImageUploader disabled={isPending} files={form.images} onChange={files => updateForm("images", files)} />

          <button
            className="btn rounded-lg bg-blue-600 text-white"
            disabled={isPending || !nftInfo?.address}
            type="submit"
          >
            {isPending ? "Processing..." : "Upload and mint NFT"}
          </button>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <p className="m-0 text-sm text-slate-500">AuctionNFT contract</p>
            <p className="m-0 mt-2 break-all text-sm font-semibold text-white">{nftInfo?.address || "Not deployed"}</p>
          </div>
          <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-5 text-sm text-blue-100">
            Platform-created physical items are claim certificates. ChainBid can escrow the NFT and release funds after
            on-chain confirmation, but real-world delivery is handled off-chain.
          </div>
          {metadataUri && (
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-5">
              <p className="m-0 text-sm font-semibold text-emerald-100">Uploaded metadata URI</p>
              <p className="m-0 mt-2 break-all text-xs text-emerald-200">{metadataUri}</p>
            </div>
          )}
        </aside>
      </form>
    </div>
  );
};

export default CreateItemPage;
