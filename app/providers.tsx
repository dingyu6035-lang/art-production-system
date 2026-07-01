"use client";

import { SWRConfig } from "swr";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 5000,
        focusThrottleInterval: 10000,
        shouldRetryOnError: false,
        revalidateOnReconnect: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
