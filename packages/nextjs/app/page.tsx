"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { AuctionCard } from "~~/components/chainbid/AuctionCard";
import { useAuctionNow } from "~~/components/chainbid/useAuctionNow";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import type { AuctionRecord } from "~~/types/chainbid";

type TypeFilter = "All" | "English" | "Dutch" | "Vickrey";
const typeFilters: TypeFilter[] = ["All", "English", "Dutch", "Vickrey"];

const Home: NextPage = () => {
  const { isConnected } = useAccount();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
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
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {/* Filter bar */}
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#0a1224] px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Format</span>
        <div className="flex flex-wrap gap-2">
          {typeFilters.map(option => (
            <button
              key={option}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                typeFilter === option
                  ? "bg-blue-600 text-white"
                  : "bg-white/[0.05] text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
              onClick={() => setTypeFilter(option)}
              type="button"
            >
              {option}
            </button>
          ))}
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

      {factoryInfo?.address && !isLoading && records.length === 0 && (
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

      {records.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {records.map(record => (
            <AuctionCard
              key={record.contractAddress}
              assetFilter="All"
              now={now}
              record={record}
              statusFilter="All"
              typeFilter={typeFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
