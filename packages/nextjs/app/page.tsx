"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { AuctionCard } from "~~/components/chainbid/AuctionCard";
import type { AuctionCardResolvedData } from "~~/components/chainbid/AuctionCard";
import { useAuctionNow } from "~~/components/chainbid/useAuctionNow";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import type { AuctionRecord, AuctionStatus } from "~~/types/chainbid";
import { AuctionType } from "~~/types/chainbid";

type TypeFilter = "All" | "English" | "Dutch" | "Vickrey";
type StatusFilter = "All" | "Active" | "Commit" | "Reveal" | "Ended" | "Finalized";
type AssetFilter = "All" | "Digital" | "Physical";
type SortBy = "Newest" | "Oldest" | "Price ↑" | "Price ↓" | "Ending Soon";

const typeFilters: TypeFilter[] = ["All", "English", "Dutch", "Vickrey"];
const statusFilters: StatusFilter[] = ["All", "Active", "Commit", "Reveal", "Ended", "Finalized"];
const assetFilters: AssetFilter[] = ["All", "Digital", "Physical"];
const sortOptions: SortBy[] = ["Newest", "Oldest", "Price ↑", "Price ↓", "Ending Soon"];

const matchesStatusFilter = (status: AuctionStatus, filter: StatusFilter): boolean => {
  if (filter === "All") return true;
  if (filter === "Active") return status === "active" || status === "commit" || status === "reveal";
  if (filter === "Commit") return status === "commit";
  if (filter === "Reveal") return status === "reveal";
  if (filter === "Ended") return status === "ended";
  return status === "finalized" || status === "awaiting-confirmation";
};

const FilterButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
      active ? "bg-blue-600 text-white" : "bg-white/[0.05] text-slate-400 hover:bg-white/10 hover:text-white"
    }`}
  >
    {children}
  </button>
);

const Home: NextPage = () => {
  const { isConnected } = useAccount();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("All");
  const [sortBy, setSortBy] = useState<SortBy>("Newest");
  const [search, setSearch] = useState("");
  const [resolvedData, setResolvedData] = useState<Map<string, AuctionCardResolvedData>>(new Map());

  const now = useAuctionNow();
  const { data: factoryInfo } = useDeployedContractInfo({ contractName: "AuctionFactory" });
  const { data: auctions, isLoading } = useScaffoldReadContract({
    contractName: "AuctionFactory",
    functionName: "getAllAuctions",
    query: { enabled: Boolean(factoryInfo?.address) },
  });

  const onResolved = useCallback((address: Address, data: AuctionCardResolvedData) => {
    setResolvedData(prev => {
      const existing = prev.get(address);
      if (
        existing?.price === data.price &&
        existing?.endTime === data.endTime &&
        existing?.status === data.status &&
        existing?.assetType === data.assetType &&
        existing?.name === data.name
      ) {
        return prev;
      }
      const next = new Map(prev);
      next.set(address, data);
      return next;
    });
  }, []);

  const allRecords = useMemo(() => {
    const values = (auctions || []) as AuctionRecord[];
    return [...values].reverse();
  }, [auctions]);

  const records = useMemo(() => {
    const q = search.toLowerCase().trim();

    const auctionTypeNum = (r: AuctionRecord) => Number(r.auctionType);

    const filtered = allRecords.filter(r => {
      // Type filter — available immediately from AuctionRecord
      if (typeFilter !== "All") {
        const t = auctionTypeNum(r);
        if (typeFilter === "English" && t !== AuctionType.English) return false;
        if (typeFilter === "Dutch" && t !== AuctionType.Dutch) return false;
        if (typeFilter === "Vickrey" && t !== AuctionType.Vickrey) return false;
      }

      const data = resolvedData.get(r.contractAddress);

      // Unresolved records pass all remaining filters while loading
      if (!data) return true;

      if (q) {
        const nameMatch = data.name.toLowerCase().includes(q);
        const addrMatch = r.contractAddress.toLowerCase().includes(q);
        const sellerMatch = r.seller.toLowerCase().includes(q);
        if (!nameMatch && !addrMatch && !sellerMatch) return false;
      }

      if (assetFilter !== "All" && data.assetType !== assetFilter) return false;
      if (!matchesStatusFilter(data.status, statusFilter)) return false;

      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "Newest") return Number(b.createdAt - a.createdAt);
      if (sortBy === "Oldest") return Number(a.createdAt - b.createdAt);

      const aData = resolvedData.get(a.contractAddress);
      const bData = resolvedData.get(b.contractAddress);

      if (sortBy === "Price ↑" || sortBy === "Price ↓") {
        if (!aData && !bData) return Number(b.createdAt - a.createdAt);
        if (!aData) return 1;
        if (!bData) return -1;
        const diff = aData.price < bData.price ? -1 : aData.price > bData.price ? 1 : 0;
        return sortBy === "Price ↑" ? diff : -diff;
      }

      if (sortBy === "Ending Soon") {
        if (!aData && !bData) return Number(b.createdAt - a.createdAt);
        if (!aData) return 1;
        if (!bData) return -1;
        return aData.endTime < bData.endTime ? -1 : aData.endTime > bData.endTime ? 1 : 0;
      }

      return 0;
    });
  }, [allRecords, typeFilter, statusFilter, assetFilter, sortBy, search, resolvedData]);

  const hasActiveFilters =
    typeFilter !== "All" || statusFilter !== "All" || assetFilter !== "All" || search.trim() !== "";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {/* Filter / Sort bar */}
      <section className="space-y-3 rounded-3xl border border-white/10 bg-[#0a1224] px-4 py-3">
        {/* Search + Sort row */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by name, address, or seller…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="min-w-[200px] flex-1 rounded-xl bg-white/[0.05] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Sort</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              className="rounded-xl bg-white/[0.05] px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
            >
              {sortOptions.map(opt => (
                <option key={opt} value={opt} className="bg-[#0a1224]">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Format / Status / Asset filter rows */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Format</span>
            <div className="flex flex-wrap gap-1.5">
              {typeFilters.map(opt => (
                <FilterButton key={opt} active={typeFilter === opt} onClick={() => setTypeFilter(opt)}>
                  {opt}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {statusFilters.map(opt => (
                <FilterButton key={opt} active={statusFilter === opt} onClick={() => setStatusFilter(opt)}>
                  {opt}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Asset</span>
            <div className="flex flex-wrap gap-1.5">
              {assetFilters.map(opt => (
                <FilterButton key={opt} active={assetFilter === opt} onClick={() => setAssetFilter(opt)}>
                  {opt}
                </FilterButton>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter("All");
                setStatusFilter("All");
                setAssetFilter("All");
                setSearch("");
              }}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {!isConnected && (
        <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          Connect your wallet to create auctions and use bid/buy actions. Browsing remains available.
        </div>
      )}

      {!factoryInfo?.address && (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#0a1224] p-8 text-center">
          <h3 className="m-0 text-lg font-semibold text-white">AuctionFactory is not deployed</h3>
          <p className="m-0 mt-2 text-sm text-slate-400">
            Run `yarn deploy` against your selected network to populate deployedContracts.ts.
          </p>
        </div>
      )}

      {factoryInfo?.address && isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(index => (
            <div key={index} className="overflow-hidden rounded-xl border border-white/10 bg-[#0a1224]">
              <div className="skeleton aspect-[4/3] w-full bg-white/10" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-1/3 rounded bg-white/10" />
                <div className="h-5 w-2/3 rounded bg-white/10" />
                <div className="h-4 w-full rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      )}

      {factoryInfo?.address && !isLoading && allRecords.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#0a1224] p-8 text-center">
          <h3 className="m-0 text-lg font-semibold text-white">No auctions yet</h3>
          <p className="m-0 mt-2 text-sm text-slate-400">
            Mint a platform item or list an existing NFT to create the first auction.
          </p>
          <Link href="/create-auction" className="btn mt-5 rounded-lg bg-blue-600 text-white">
            Create auction
          </Link>
        </div>
      )}

      {factoryInfo?.address && !isLoading && allRecords.length > 0 && records.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#0a1224] p-8 text-center">
          <p className="m-0 text-sm text-slate-400">No auctions match your filters.</p>
          <button
            type="button"
            onClick={() => {
              setTypeFilter("All");
              setStatusFilter("All");
              setAssetFilter("All");
              setSearch("");
            }}
            className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition"
          >
            Clear filters
          </button>
        </div>
      )}

      {records.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {records.map(record => (
            <AuctionCard key={record.contractAddress} now={now} record={record} onResolved={onResolved} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
