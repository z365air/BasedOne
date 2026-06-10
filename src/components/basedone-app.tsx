"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  type Address,
  createPublicClient,
  getAddress,
  http,
  isAddress,
  zeroAddress,
} from "viem";
import { baseSepolia } from "viem/chains";
import { parseSiweMessage, verifySiweMessage } from "viem/siwe";
import { StaticCover } from "@/components/static-cover";
import {
  BASEDONE_ABI,
  BASEDONE_CHAIN_ID,
  BASEDONE_CONTRACT_ADDRESS,
  shortenAddress,
} from "@/lib/basedone";

type WalletConnectSignInCapability = {
  message: string;
  signature: `0x${string}`;
};

type WalletConnectResult = {
  accounts?: Array<{
    address?: Address;
    capabilities?: {
      signInWithEthereum?: WalletConnectSignInCapability | { message?: string };
    };
  }>;
};

type Eip1193Provider = {
  request(args: {
    method: string;
    params?: unknown[];
  }): Promise<unknown>;
};

function createNonce() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replaceAll("-", "");
  }

  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function readErrorField(error: unknown, key: string) {
  if (typeof error !== "object" || error === null) return undefined;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return JSON.stringify(
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...Object.fromEntries(Object.entries(error as unknown as Record<string, unknown>)),
      },
      null,
      2,
    );
  }

  if (typeof error === "object" && error !== null) {
    return JSON.stringify(error, null, 2);
  }

  return String(error);
}

const baseSepoliaPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

export function BasedOneApp() {
  const { address, isConnected, isConnecting, connector } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { data: mintHash, isPending: isWritePending, writeContractAsync } = useWriteContract();
  const mintReceipt = useWaitForTransactionReceipt({
    hash: mintHash,
    chainId: BASEDONE_CHAIN_ID,
    query: {
      enabled: Boolean(mintHash),
    },
  });
  const [hydrated, setHydrated] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Waiting for client hydration...");
  const [signatureState, setSignatureState] = useState<"idle" | "received">("idle");
  const [siwbVerified, setSiwbVerified] = useState(false);
  const [siwbChainVerified, setSiwbChainVerified] = useState(false);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [walletChainHex, setWalletChainHex] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);
  const [lastErrorDetails, setLastErrorDetails] = useState<string | null>(null);
  const [lastErrorRaw, setLastErrorRaw] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHydrated(true);
      setStatusMessage("Ready for Base login.");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const sourceAddress = address ? getAddress(address) : null;
  const baseConnector =
    connectors.find((connector) => connector.id === "baseAccount") ??
    connectors.find((connector) => connector.name.toLowerCase().includes("base"));
  const normalizedTarget = useMemo(() => {
    const value = targetInput.trim();
    return isAddress(value) ? getAddress(value) : null;
  }, [targetInput]);

  const eligibility = useReadContract({
    address: BASEDONE_CONTRACT_ADDRESS,
    abi: BASEDONE_ABI,
    functionName: "hasMintedFromSource",
    args: [sourceAddress ?? zeroAddress],
    chainId: BASEDONE_CHAIN_ID,
    query: {
      enabled: Boolean(sourceAddress),
    },
  });

  const alreadyMinted = eligibility.data === true;
  const chainReady = walletChainId === BASEDONE_CHAIN_ID;
  const targetReady = Boolean(normalizedTarget);
  const mintBusy = isWritePending || mintReceipt.isLoading;
  const canMint =
    Boolean(sourceAddress) &&
    targetReady &&
    chainReady &&
    !eligibility.isLoading &&
    !mintBusy;

  useEffect(() => {
    if (!isConnected || !sourceAddress || !connector) return;

    let cancelled = false;
    const activeConnector = connector;

    async function syncProviderState() {
      try {
        const nextProvider = (await activeConnector.getProvider()) as
          | Eip1193Provider
          | undefined;
        if (!nextProvider || cancelled) return;

        setProvider(nextProvider);
        await updateChainState(nextProvider);
      } catch {
        if (!cancelled) {
          setProvider(null);
        }
      }
    }

    void syncProviderState();

    return () => {
      cancelled = true;
    };
  }, [connector, isConnected, sourceAddress]);

  useEffect(() => {
    if (mintReceipt.isSuccess) {
      void eligibility.refetch();
    }
  }, [eligibility, mintReceipt.isSuccess]);

  async function updateChainState(nextProvider: Eip1193Provider) {
    const chainIdHex = (await nextProvider.request({
      method: "eth_chainId",
    })) as `0x${string}`;

    setWalletChainHex(chainIdHex);
    setWalletChainId(Number.parseInt(chainIdHex, 16));
  }

  async function handleBaseLogin() {
    setIsSigningIn(true);
    setStatusMessage("Opening Base Account...");

    try {
      if (!baseConnector) {
        throw new Error("Base Account connector is unavailable.");
      }

      await connectAsync({ connector: baseConnector });

      const resolvedProvider = (await baseConnector.getProvider()) as
        | Eip1193Provider
        | undefined;

      if (!resolvedProvider) {
        throw new Error("Base provider is unavailable in this browser.");
      }

      const result = (await resolvedProvider.request({
        method: "wallet_connect",
        params: [
          {
            version: "1",
            capabilities: {
              signInWithEthereum: {
                nonce: createNonce(),
                chainId: `0x${BASEDONE_CHAIN_ID.toString(16)}`,
              },
            },
          },
        ],
      })) as WalletConnectResult;

      const account = result.accounts?.[0]?.address;

      if (!account) {
        throw new Error("Base did not return an account.");
      }

      const signInWithEthereum = result.accounts?.[0]?.capabilities?.signInWithEthereum;
      const signatureReceived =
        typeof signInWithEthereum === "object" &&
        signInWithEthereum !== null &&
        "signature" in signInWithEthereum;

      let verified = false;
      let chainVerified = false;

      if (signatureReceived) {
        const message = signInWithEthereum.message;
        const signature = signInWithEthereum.signature;
        const parsedMessage = parseSiweMessage(message);
        const parsedChainId =
          parsedMessage.chainId !== undefined
            ? Number(parsedMessage.chainId)
            : undefined;

        verified = await verifySiweMessage(baseSepoliaPublicClient, {
          address: account,
          message,
          signature,
        });
        chainVerified = verified && parsedChainId === BASEDONE_CHAIN_ID;
      }

      setProvider(resolvedProvider);
      setSignatureState(signatureReceived ? "received" : "idle");
      setSiwbVerified(verified);
      setSiwbChainVerified(chainVerified);
      await updateChainState(resolvedProvider);
      setStatusMessage(
        chainVerified
          ? "Base login completed and Base Sepolia SIWB proof verified."
          : signatureReceived
            ? "Base login completed and SIWB signature received."
            : "Base login completed.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Base login error.";

      setStatusMessage(message);
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSwitchNetwork() {
    if (!isConnected) {
      setStatusMessage("Sign in with Base first.");
      return;
    }

    try {
      setStatusMessage("Switching wallet network to Base Sepolia...");
      await switchChainAsync({ chainId: BASEDONE_CHAIN_ID });
      if (provider) {
        await updateChainState(provider);
      }
      setStatusMessage("Wallet switched to Base Sepolia.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Network switch failed.";

      setStatusMessage(message);
    }
  }

  async function handleMint() {
    if (!isConnected) {
      setStatusMessage("Sign in with Base first.");
      return;
    }

    if (!sourceAddress) {
      setStatusMessage("No source wallet connected.");
      return;
    }

    if (!normalizedTarget) {
      setStatusMessage("Enter a valid target EOA.");
      return;
    }

    if (!chainReady) {
      setStatusMessage("Switch to Base Sepolia before minting.");
      return;
    }

    try {
      setLastErrorCode(null);
      setLastErrorMessage(null);
      setLastErrorDetails(null);
      setLastErrorRaw(null);
      setStatusMessage("Preparing mint transaction...");

      await writeContractAsync({
        address: BASEDONE_CONTRACT_ADDRESS,
        abi: BASEDONE_ABI,
        functionName: "mint",
        args: [normalizedTarget, 0n, "0x"],
        chainId: BASEDONE_CHAIN_ID,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mint request failed.";
      const code = readErrorField(error, "code");
      const details =
        readErrorField(error, "details") ??
        readErrorField(error, "shortMessage") ??
        readErrorField(error, "cause");

      setStatusMessage(message);
      setLastErrorCode(code ?? null);
      setLastErrorMessage(message);
      setLastErrorDetails(details ?? null);
      setLastErrorRaw(serializeError(error));
    }
  }

  const eligibilityLabel = !sourceAddress
    ? "Sign in required"
    : eligibility.isLoading
      ? "Checking"
      : alreadyMinted
        ? "Already used"
        : "Eligible";
  const transactionStatusMessage = isWritePending
    ? "Confirm mint in Base Account..."
    : mintReceipt.isLoading && mintHash
      ? "Mint submitted. Waiting for Base Sepolia confirmation..."
      : mintReceipt.isSuccess
        ? "Mint confirmed on Base Sepolia."
        : mintReceipt.isError
          ? "Mint failed onchain."
          : null;

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[var(--surface)] px-4 md:px-8"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.75rem))",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(27,67,255,0.16),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(117,206,255,0.16),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.84),rgba(244,248,255,0.94))]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-md flex-col justify-center gap-4">
        <section className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.72)] shadow-[0_30px_100px_rgba(34,74,255,0.08)] backdrop-blur-xl">
          <div className="aspect-[768/590] w-full">
            <StaticCover alt="BasedOne animated cover" />
          </div>
        </section>

        <section className="relative z-50 w-full rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_30px_100px_rgba(34,74,255,0.08)] backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleBaseLogin}
              disabled={!hydrated || isSigningIn}
              className="h-14 w-full touch-manipulation rounded-[1.2rem] bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] px-4 text-sm font-semibold tracking-[0.02em] text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isSigningIn ? "Signing in..." : "Sign in with Base"}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                Connected
                <div className="mt-2 text-xs tracking-[0.08em] text-[var(--ink)]">
                  {sourceAddress ? shortenAddress(sourceAddress) : isConnecting ? "Connecting" : "Not connected"}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                SIWB
                <div className="mt-2 text-xs tracking-[0.08em] text-[var(--ink)]">
                  {signatureState === "received"
                    ? siwbVerified
                      ? "Verified"
                      : "Received"
                    : "Not received"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                Eligibility
                <div className="mt-2 text-xs tracking-[0.08em] text-[var(--ink)]">
                  {eligibilityLabel}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                Network
                <div className="mt-2 text-xs tracking-[0.08em] text-[var(--ink)]">
                  {walletChainId === null
                    ? "Unknown"
                    : chainReady
                      ? "Base Sepolia"
                      : `Chain ${walletChainId}`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                Raw Chain ID
                <div className="mt-2 break-all text-xs tracking-[0.08em] text-[var(--ink)]">
                  {walletChainHex ?? "Unknown"}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                Tx Path
                <div className="mt-2 break-all text-xs tracking-[0.08em] text-[var(--ink)]">
                  Write Contract
                </div>
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
              Chain Proof
              <div className="mt-2 text-xs tracking-[0.08em] text-[var(--ink)]">
                {siwbChainVerified ? "Signed for Base Sepolia" : "Not verified"}
              </div>
            </div>

            <label className="flex flex-col gap-2 rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                Target EOA
              </span>
              <input
                value={targetInput}
                onChange={(event) => setTargetInput(event.target.value)}
                placeholder="0x..."
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="h-12 rounded-[1rem] border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink)] outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTargetInput(sourceAddress ?? "")}
                  disabled={!sourceAddress}
                  className="h-10 flex-1 rounded-[1rem] border border-[var(--line)] bg-[#f5f8ff] px-3 text-xs font-semibold tracking-[0.04em] text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use connected
                </button>
                <button
                  type="button"
                  onClick={() => setTargetInput("")}
                  className="h-10 flex-1 rounded-[1rem] border border-[var(--line)] bg-[#f5f8ff] px-3 text-xs font-semibold tracking-[0.04em] text-[var(--ink)]"
                >
                  Clear
                </button>
              </div>
            </label>

            {!chainReady && sourceAddress ? (
              <button
                type="button"
                onClick={handleSwitchNetwork}
                disabled={isSwitching}
                className="h-12 w-full rounded-[1.1rem] border border-[var(--line)] bg-white px-4 text-sm font-semibold tracking-[0.02em] text-[var(--ink)]"
              >
                {isSwitching ? "Switching..." : "Switch to Base Sepolia"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleMint}
              disabled={!canMint}
              className="h-14 w-full touch-manipulation rounded-[1.2rem] bg-[linear-gradient(135deg,#0f1733,#2953ff)] px-4 text-sm font-semibold tracking-[0.02em] text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {mintBusy ? "Minting..." : "Mint BasedOne"}
            </button>

            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
              {transactionStatusMessage ?? statusMessage}
            </div>

            {(lastErrorCode || lastErrorMessage || lastErrorDetails) ? (
              <div className="rounded-[1.2rem] border border-[rgba(176,58,58,0.16)] bg-[rgba(255,245,245,0.92)] p-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#8f3131]">
                <div>Error Code: {lastErrorCode ?? "n/a"}</div>
                <div className="mt-2 break-words normal-case tracking-[0.02em]">
                  {lastErrorMessage ?? "No error message"}
                </div>
                {lastErrorDetails ? (
                  <div className="mt-2 break-words normal-case tracking-[0.02em]">
                    {lastErrorDetails}
                  </div>
                ) : null}
              </div>
            ) : null}

            {lastErrorRaw ? (
              <pre className="overflow-x-auto rounded-[1.2rem] border border-[rgba(176,58,58,0.12)] bg-[rgba(255,250,250,0.96)] p-4 text-[10px] leading-5 text-[#7a2e2e]">
                {lastErrorRaw}
              </pre>
            ) : null}

            {mintHash ? (
              <a
                href={`https://sepolia.basescan.org/tx/${mintHash}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]"
              >
                Mint Tx: {shortenAddress(mintHash)}
              </a>
            ) : null}
          </div>

          <div className="mt-5 border-t border-[var(--line)] px-1 pt-3 text-center text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
            v0.1.9
          </div>
        </section>
      </div>
    </main>
  );
}
