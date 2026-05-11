"use client";

import { useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { zeroAddress } from "viem";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { AlertBox } from "~~/components/chainbid/AlertBox";
import { StatCard } from "~~/components/chainbid/StatCard";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { AuctionRecord, AuctionType } from "~~/types/chainbid";
import { AUCTION_TYPE_LABELS, compactAddress } from "~~/utils/chainbid/auction";

type Tab = "listed" | "won" | "minted";

const TYPE_BADGE_STYLE: Record<AuctionType, { bg: string; text: string }> = {
  [AuctionType.English]: { bg: "bg-blue-500/20", text: "text-blue-300" },
  [AuctionType.Dutch]: { bg: "bg-orange-500/20", text: "text-orange-300" },
  [AuctionType.Vickrey]: { bg: "bg-violet-500/20", text: "text-violet-300" },
};

const PortfolioPage: NextPage = () => {
  const { address } = useAccount();
  const [tab, setTab] = useState<Tab>("listed");

  const { data: sellerAuctions } = useScaffoldReadContract({
    contractName: "AuctionFactory",
    functionName: "getAuctionsBySeller",
    args: [address],
    query: { enabled: Boolean(address) },
  });
  const { data: allAuctions } = useScaffoldReadContract({
    contractName: "AuctionFactory",
    functionName: "getAllAuctions",
  });
  const { data: wonAuctions } = useScaffoldReadContract({
    contractName: "AuctionFactory",
    functionName: "getAuctionsByWinner",
    args: [address],
    query: { enabled: Boolean(address) },
  });
  const { data: transferEvents } = useScaffoldEventHistory({
    contractName: "AuctionNFT",
    eventName: "Transfer",
    fromBlock: 0n,
    filters: address ? { from: zeroAddress, to: address } : undefined,
    watch: true,
    enabled: Boolean(address),
  });

  const createdAddresses = (sellerAuctions || []) as Address[];
  const allAuctionRecords = (allAuctions || []) as AuctionRecord[];
  const listedAuctions = allAuctionRecords.filter(r => createdAddresses.includes(r.contractAddress));
  const wonAuctionRecords = (wonAuctions || []) as AuctionRecord[];
  const mintedTokenIds = (transferEvents || [])
    .map(e => e.args?.tokenId)
    .filter((id): id is bigint => typeof id === "bigint");

  const tabs: [Tab, string][] = [
    ["listed", "Listed"],
    ["won", "Won"],
    ["minted", "Minted NFTs"],
  ];

  const AuctionTable = ({ records }: { records: AuctionRecord[] }) => (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {["Lot", "Format", "Action"].map((h, i) => (
              <th
                key={h}
                className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 ${i === 2 ? "text-right" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record, i) => {
            const auctionType = Number(record.auctionType) as AuctionType;
            const { bg, text } = TYPE_BADGE_STYLE[auctionType];
            const label = AUCTION_TYPE_LABELS[auctionType];
            return (
              <tr
                key={record.contractAddress}
                className={`border-b border-white/5 last:border-0 ${i % 2 === 1 ? "bg-white/[0.015]" : ""}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{compactAddress(record.contractAddress)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${bg} ${text}`}>
                    {label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/auction/${record.contractAddress}`}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {!address && (
        <AlertBox variant="info" className="rounded-lg p-5">
          Connect your wallet to view portfolio data.
        </AlertBox>
      )}

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Listed" value={listedAuctions.length} valueClassName="mt-2 text-4xl font-bold text-blue-400" />
        <StatCard
          label="Total on platform"
          value={allAuctionRecords.length}
          valueClassName="mt-2 text-4xl font-bold text-emerald-400"
        />
        <StatCard
          label="NFTs minted"
          value={mintedTokenIds.length}
          valueClassName="mt-2 text-4xl font-bold text-amber-400"
        />
        <StatCard
          label="Wallet"
          value={address ? compactAddress(address) : "—"}
          valueClassName="mt-3 break-all font-mono text-xs font-semibold text-slate-300"
        />
      </section>

      {/* Tab bar */}
      <div className="border-b border-white/10">
        <div className="flex gap-1">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === id ? "border-blue-500 text-white" : "border-transparent text-slate-500 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "listed" && (
        <section>
          {listedAuctions.length === 0 ? (
            <p className="text-sm text-slate-500">No auctions listed from this wallet yet.</p>
          ) : (
            <AuctionTable records={listedAuctions} />
          )}
        </section>
      )}

      {tab === "won" && (
        <section>
          {wonAuctionRecords.length === 0 ? (
            <p className="text-sm text-slate-500">No won auctions found for this wallet.</p>
          ) : (
            <AuctionTable records={wonAuctionRecords} />
          )}
        </section>
      )}

      {tab === "minted" && (
        <section>
          {mintedTokenIds.length === 0 ? (
            <p className="text-sm text-slate-500">No AuctionNFT mints found for this wallet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {mintedTokenIds.map(tokenId => (
                <span
                  key={tokenId.toString()}
                  className="rounded-lg border border-white/10 bg-[#0a1224] px-3 py-2 text-sm font-semibold text-white"
                >
                  Token #{tokenId.toString()}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default PortfolioPage;
