"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { AuctionCard } from "~~/components/chainbid/AuctionCard";
import { useAuctionNow } from "~~/components/chainbid/useAuctionNow";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import type { AuctionRecord } from "~~/types/chainbid";

type TypeFilter = "All" | "English" | "Dutch";
type AssetFilter = "All" | "Digital" | "Physical";
type StatusFilter = "All" | "Active" | "Ended" | "Finalized" | "Awaiting confirmation";

const typeFilters: TypeFilter[] = ["All", "English", "Dutch"];
const assetFilters: AssetFilter[] = ["All", "Digital", "Physical"];
const statusFilters: StatusFilter[] = ["All", "Active", "Ended", "Finalized", "Awaiting confirmation"];

const FilterGroup = <T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) => (
  <div>
    <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <div className="flex flex-wrap gap-2">
      {options.map(option => (
        <button
          key={option}
          className={`btn btn-sm rounded-lg border-white/10 ${
            value === option ? "btn-primary bg-blue-600 text-white" : "bg-white/[0.04] text-slate-300"
          }`}
          onClick={() => onChange(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  </div>
);

const Home: NextPage = () => {
  const { isConnected } = useAccount();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const now = useAuctionNow();
  const { data: factoryInfo } = useDeployedContractInfo({ contractName: "AuctionFactory" });
  const { data: auctions, isLoading } = useScaffoldReadContract({
    contractName: "AuctionFactory",
    functionName: "getAllAuctions",
    query: { enabled: Boolean(factoryInfo?.address) },
  });

  const records = useMemo(() => {
    const values = (auctions || []) as AuctionRecord[];
    return [...values].reverse();
  }, [auctions]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <p className="m-0 text-sm font-semibold uppercase tracking-wide text-blue-200">ChainBid marketplace</p>
          <h2 className="m-0 mt-3 text-2xl font-semibold text-white sm:text-3xl">
            NFT-backed auctions, without guesswork
          </h2>
          <p className="m-0 mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Browse factory-created English and Dutch auction clones. Physical listings use an NFT claim certificate;
            delivery remains off-chain and buyer confirmation releases payment when supported by the contract.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <p className="m-0 text-sm text-slate-500">Factory</p>
          <p className="m-0 mt-2 break-all text-sm font-semibold text-white">
            {factoryInfo?.address || "Not deployed"}
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/create-item" className="btn btn-sm rounded-lg bg-blue-600 text-white">
              Create item
            </Link>
            <Link
              href="/create-auction"
              className="btn btn-sm rounded-lg border-white/10 bg-white/[0.06] text-slate-200"
            >
              List NFT
            </Link>
          </div>
        </div>
      </section>

      {!isConnected && (
        <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          Connect your wallet to create auctions and use bid/buy actions. Browsing remains available.
        </div>
      )}

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <FilterGroup label="Auction type" options={typeFilters} value={typeFilter} onChange={setTypeFilter} />
          <FilterGroup label="Asset type" options={assetFilters} value={assetFilter} onChange={setAssetFilter} />
          <FilterGroup label="Status" options={statusFilters} value={statusFilter} onChange={setStatusFilter} />
        </div>
      </section>

      {!factoryInfo?.address && (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
          <h3 className="m-0 text-lg font-semibold text-white">AuctionFactory is not deployed</h3>
          <p className="m-0 mt-2 text-sm text-slate-400">
            Run `yarn deploy` against your selected network to populate deployedContracts.ts.
          </p>
        </div>
      )}

      {factoryInfo?.address && isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(index => (
            <div key={index} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="skeleton h-44 w-full rounded-lg bg-white/10" />
              <div className="mt-4 h-5 w-2/3 rounded bg-white/10" />
              <div className="mt-2 h-4 w-full rounded bg-white/10" />
            </div>
          ))}
        </div>
      )}

      {factoryInfo?.address && !isLoading && records.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
          <h3 className="m-0 text-lg font-semibold text-white">No auctions yet</h3>
          <p className="m-0 mt-2 text-sm text-slate-400">
            Mint a platform item or list an existing NFT to create the first auction.
          </p>
          <Link href="/create-auction" className="btn mt-5 rounded-lg bg-blue-600 text-white">
            Create auction
          </Link>
        </div>
      )}

      {records.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {records.map(record => (
            <AuctionCard
              key={record.contractAddress}
              assetFilter={assetFilter}
              now={now}
              record={record}
              statusFilter={statusFilter}
              typeFilter={typeFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
