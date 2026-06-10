"use client";

import { QueryClient } from "@tanstack/react-query";
import {
  cookieStorage,
  createConfig,
  createStorage,
  http,
} from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { baseAccount } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  multiInjectedProviderDiscovery: false,
  connectors: [
    baseAccount({
      appName: "BasedOne",
    }),
  ],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});

export const queryClient = new QueryClient();

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
