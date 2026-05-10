"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import {
  Bars3Icon,
  ChartBarIcon,
  CubeIcon,
  PlusCircleIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useTargetNetwork } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Auctions",
    href: "/",
    icon: <Squares2X2Icon className="h-5 w-5" />,
  },
  {
    label: "Create auction",
    href: "/create-auction",
    icon: <PlusCircleIcon className="h-5 w-5" />,
  },
  {
    label: "Portfolio",
    href: "/portfolio",
    icon: <RectangleStackIcon className="h-5 w-5" />,
  },
];

const getPageTitle = (pathname: string) => {
  if (pathname.startsWith("/create-auction")) return "Create auction";
  if (pathname.startsWith("/auction/")) return "Auction";
  if (pathname.startsWith("/portfolio")) return "Portfolio";
  return "Marketplace";
};

const getPageSubtitle = (pathname: string) => {
  if (pathname.startsWith("/create-auction"))
    return "List an NFT or consign a physical item — we wrap it as a certificate.";
  if (pathname.startsWith("/auction/")) return "Bid, buy, finalize, withdraw, or confirm physical delivery.";
  if (pathname.startsWith("/portfolio")) return "Active bids, watchlist, wins, and listings.";
  return "Live & upcoming auctions across English, Dutch, and Vickrey formats.";
};

const MobileMenuLinks = ({ onNavigate }: { onNavigate?: () => void }) => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href, icon }) => {
        const isActive = href === "/" ? pathname === "/" || pathname === "/auctions" : pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
};

const SidebarMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href, icon }) => {
        const isActive = href === "/" ? pathname === "/" || pathname === "/auctions" : pathname.startsWith(href);
        return (
          <li key={href} className="relative w-full">
            <span
              className={`absolute inset-y-1 left-0 w-0.5 rounded-r bg-blue-500 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`}
            />
            <Link
              href={href}
              title={label}
              className={`flex w-full items-center justify-center py-3 transition ${
                isActive ? "text-white" : "text-slate-500 hover:text-white"
              }`}
            >
              {icon}
            </Link>
          </li>
        );
      })}
    </>
  );
};

export const Header = () => {
  const pathname = usePathname();
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const drawerRef = useRef<HTMLDetailsElement>(null);

  useOutsideClick(drawerRef, () => {
    drawerRef.current?.removeAttribute("open");
  });

  const closeDrawer = () => drawerRef.current?.removeAttribute("open");

  return (
    <>
      {/* Desktop sidebar — narrow, icon-only */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[72px] flex-col items-center border-r border-white/10 bg-[#070a12] py-4 lg:flex">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <CubeIcon className="h-5 w-5 text-white" />
        </Link>
        <nav className="mt-6 w-full">
          <ul className="space-y-1">
            <SidebarMenuLinks />
          </ul>
        </nav>
        <div className="mt-auto mb-3 flex flex-col items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-400" title={targetNetwork.name} />
          <span className="text-[9px] uppercase tracking-widest text-slate-600">{targetNetwork.name.slice(0, 3)}</span>
        </div>
      </aside>

      {/* Top header */}
      <header className="fixed left-0 right-0 top-0 z-20 border-b border-white/10 bg-[#05070d]/95 backdrop-blur lg:left-[72px]">
        <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile hamburger */}
            <details className="dropdown lg:hidden" ref={drawerRef}>
              <summary className="btn btn-square btn-ghost border border-white/10 text-white">
                <Bars3Icon className="h-5 w-5" />
              </summary>
              <div className="dropdown-content z-40 mt-3 w-72 rounded-xl border border-white/10 bg-[#070a12] p-4 shadow-2xl">
                <div className="mb-5 flex items-center justify-between">
                  <Link href="/" className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
                      <CubeIcon className="h-5 w-5 text-white" />
                    </span>
                    <span className="text-base font-bold text-white">ChainBid</span>
                  </Link>
                  <button
                    className="btn btn-square btn-ghost btn-sm text-slate-400"
                    onClick={closeDrawer}
                    type="button"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <ul className="space-y-1">
                  <MobileMenuLinks onNavigate={closeDrawer} />
                </ul>
              </div>
            </details>
            <div className="min-w-0">
              <h1 className="m-0 truncate text-xl font-bold text-white sm:text-2xl">{getPageTitle(pathname)}</h1>
              <p className="m-0 mt-0.5 hidden truncate text-xs text-slate-500 sm:block">{getPageSubtitle(pathname)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RainbowKitCustomConnectButton />
            {isLocalNetwork && <FaucetButton />}
          </div>
        </div>
      </header>
    </>
  );
};
