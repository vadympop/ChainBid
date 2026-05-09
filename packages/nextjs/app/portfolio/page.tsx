"use client";

import Link from "next/link";
import type { NextPage } from "next";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { AuctionRecord } from "~~/types/chainbid";
import { compactAddress } from "~~/utils/chainbid/auction";

const PortfolioPage: NextPage = () => {
  const { address } = useAccount();
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
  const { data: transferEvents } = useScaffoldEventHistory({
    contractName: "AuctionNFT",
    eventName: "Transfer",
    fromBlock: 0n,
    filters: address ? { to: address } : undefined,
    watch: true,
    enabled: Boolean(address),
  });

  const created = ((sellerAuctions || []) as Address[]) || [];
  const won = ((allAuctions || []) as AuctionRecord[]).filter(record => created.includes(record.contractAddress));
  const mintedTokenIds = (transferEvents || [])
    .map(event => event.args?.tokenId)
    .filter((tokenId): tokenId is bigint => typeof tokenId === "bigint");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {!address && (
        <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-5 text-blue-100">
          Connect your wallet to view portfolio data.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <p className="m-0 text-sm text-slate-500">Created auctions</p>
          <p className="m-0 mt-2 text-3xl font-semibold text-white">{created.length}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <p className="m-0 text-sm text-slate-500">Platform NFTs minted</p>
          <p className="m-0 mt-2 text-3xl font-semibold text-white">{mintedTokenIds.length}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <p className="m-0 text-sm text-slate-500">Connected wallet</p>
          <p className="m-0 mt-2 text-sm font-semibold text-white">{compactAddress(address)}</p>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <h2 className="m-0 text-lg font-semibold text-white">Created auctions</h2>
        <div className="mt-4 space-y-2">
          {won.length === 0 && <p className="m-0 text-sm text-slate-400">No created auctions found for this wallet.</p>}
          {won.map(record => (
            <Link
              key={record.contractAddress}
              href={`/auction/${record.contractAddress}`}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm hover:border-blue-400/50"
            >
              <span className="font-semibold text-white">{compactAddress(record.contractAddress)}</span>
              <span className="text-slate-500">Open</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <h2 className="m-0 text-lg font-semibold text-white">Minted platform NFTs</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {mintedTokenIds.length === 0 && <p className="m-0 text-sm text-slate-400">No AuctionNFT mints found yet.</p>}
          {mintedTokenIds.map(tokenId => (
            <span
              key={tokenId.toString()}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
            >
              Token #{tokenId.toString()}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
};

export default PortfolioPage;
