"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import { ChainBidMetadata } from "~~/types/chainbid";

type NftMetadataPreviewProps = {
  metadata?: ChainBidMetadata;
  isLoading?: boolean;
  tokenLabel?: string;
};

export const NftMetadataPreview = ({ metadata, isLoading, tokenLabel }: NftMetadataPreviewProps) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const images = useMemo(() => {
    if (!metadata) return [];

    return [metadata.image, ...metadata.images].filter(
      (image, index, values) => image && values.indexOf(image) === index,
    );
  }, [metadata]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [metadata]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="skeleton h-44 w-full rounded-lg bg-white/10" />
        <div className="mt-4 h-4 w-2/3 rounded bg-white/10" />
        <div className="mt-2 h-3 w-full rounded bg-white/10" />
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
        Enter a token contract and token ID to preview metadata.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <div className="aspect-[4/3] bg-slate-950">
        <img
          src={images[selectedImageIndex] || metadata.image}
          alt={metadata.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="space-y-3 p-4">
        {tokenLabel && <p className="m-0 text-xs font-semibold uppercase tracking-wide text-blue-200">{tokenLabel}</p>}
        {images.length > 1 && (
          <div className="grid grid-cols-5 gap-2">
            {images.map((image, index) => (
              <button
                aria-label={`Show image ${index + 1}`}
                className={`aspect-square overflow-hidden rounded-md border bg-slate-950 transition ${
                  selectedImageIndex === index ? "border-blue-400" : "border-white/10 hover:border-blue-400/60"
                }`}
                key={image}
                onClick={() => setSelectedImageIndex(index)}
                type="button"
              >
                <img src={image} alt={`${metadata.name} ${index + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div>
          <h3 className="m-0 text-lg font-semibold text-white">{metadata.name}</h3>
          <p className="m-0 mt-1 line-clamp-3 text-sm text-slate-400">{metadata.description || "No description."}</p>
        </div>
        {metadata.fetchError && (
          <div className="rounded-md border border-amber-400/20 bg-amber-400/10 p-2 text-xs text-amber-100">
            {metadata.fetchError}
          </div>
        )}
      </div>
    </div>
  );
};
