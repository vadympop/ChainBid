"use client";

import { useEffect, useState } from "react";
import { AUCTION_CLOCK_INTERVAL_MS, getUnixTime } from "~~/utils/chainbid/auction";

export const useAuctionNow = () => {
  const [now, setNow] = useState(() => getUnixTime());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(getUnixTime());
    }, AUCTION_CLOCK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  return now;
};
