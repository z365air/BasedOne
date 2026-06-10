"use client";

import { useEffect, useState } from "react";
import { useConnect } from "wagmi";
import { BASEDONE_CHAIN_ID, shortenAddress } from "@/lib/basedone";

type WalletConnectSignInCapability = {
  message: string;
  signature: `0x${string}`;
};

type WalletConnectResult = {
  accounts?: Array<{
    address?: `0x${string}`;
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

export function BasedOneApp() {
  const { connectors } = useConnect();
  const [hydrated, setHydrated] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Waiting for client hydration...");
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [signatureState, setSignatureState] = useState<"idle" | "received">("idle");
  const [isSigningIn, setIsSigningIn] = useState(false);

  const baseConnector =
    connectors.find((connector) => connector.id === "baseAccount") ??
    connectors.find((connector) => connector.name.toLowerCase().includes("base"));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHydrated(true);
      setStatusMessage("Ready for Base login.");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleBaseLogin() {
    if (!baseConnector) {
      setStatusMessage("Base Account connector is not available.");
      return;
    }

    setIsSigningIn(true);
    setStatusMessage("Opening Base Account...");

    try {
      const provider = (await baseConnector.getProvider()) as Eip1193Provider | undefined;

      if (!provider) {
        throw new Error("Base provider is unavailable.");
      }

      const result = (await provider.request({
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

      setConnectedAccount(account);
      setSignatureState(signatureReceived ? "received" : "idle");
      setStatusMessage(
        signatureReceived
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

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[var(--surface)] px-4 md:px-8"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.75rem))",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(27,67,255,0.16),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(117,206,255,0.16),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.84),rgba(244,248,255,0.94))]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col items-stretch justify-center">
        <section className="relative z-50 w-full rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_30px_100px_rgba(34,74,255,0.08)] backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-3">
            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Hydrated: {hydrated ? "YES" : "NO"}
            </div>

            <button
              type="button"
              onClick={handleBaseLogin}
              disabled={!hydrated || !baseConnector || isSigningIn}
              className="h-14 w-full touch-manipulation rounded-[1.2rem] bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] px-4 text-sm font-semibold tracking-[0.02em] text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isSigningIn ? "Signing in..." : "Sign in with Base"}
            </button>

            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              {statusMessage}
            </div>

            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Connected Account: {connectedAccount ? shortenAddress(connectedAccount) : "Not connected"}
            </div>

            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              SIWB Signature: {signatureState === "received" ? "Received" : "Not received"}
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--line)] px-1 pt-3 text-center text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
            v0.1.3
          </div>
        </section>
      </div>
    </main>
  );
}
