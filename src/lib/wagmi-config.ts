"use client";

import { QueryClient } from "@tanstack/react-query";
import {
  cookieStorage,
  createConfig,
  createStorage,
  http,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),
    baseAccount({
      appName: "BasedOne",
    }),
  ],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [baseSepolia.id]: http(),
  },
});

export const queryClient = new QueryClient();

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
