import type { Address } from "viem";

export const BASEDONE_CHAIN_ID = 84532;

export const BASEDONE_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_BASEDONE_CONTRACT_ADDRESS as Address | undefined) ??
  "0x55B503cF081DD5a226f6B8929a4cC2c5C34AFa34";

export const BASEDONE_EXPLORER_URL = `https://sepolia.basescan.org/address/${BASEDONE_CONTRACT_ADDRESS}`;

export const BASEDONE_ABI = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mint",
    inputs: [
      { name: "target", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "targetSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "hasMintedFromSource",
    inputs: [{ name: "source", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
