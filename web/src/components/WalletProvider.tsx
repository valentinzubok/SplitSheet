"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CHAIN_ID, EXPLORER_BASE, RPC_URL } from "@/lib/config";
import type { Address } from "@/lib/genlayer";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type WalletContextValue = {
  address: Address | null;
  provider: EthereumProvider | null;
  ready: boolean;
  error: string;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function getEthereum(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

async function ensureStudioDev(eth: EthereumProvider) {
  const hexId = `0x${CHAIN_ID.toString(16)}`;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch (e) {
    if ((e as { code?: number })?.code !== 4902) throw e;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexId,
          chainName: "GenLayer Studio Dev",
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [EXPLORER_BASE],
        },
      ],
    });
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const bind = useCallback(async (eth: EthereumProvider, acc: string) => {
    const typed = acc as Address;
    try {
      // Switch/add 61997 directly; client.connect("studionet") would move the wallet to 61999.
      await ensureStudioDev(eth);
      setAddress(typed);
      setProvider(eth);
      setReady(true);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Studio Dev connect failed");
      setReady(false);
    }
  }, []);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      setError("MetaMask not found");
      return;
    }
    setError("");
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    if (accounts[0]) await bind(eth, accounts[0]);
  }, [bind]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setReady(false);
    setError("");
  }, []);

  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;
    eth
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list[0]) void bind(eth, list[0]);
      })
      .catch(() => undefined);
    const onAccounts = (accounts: unknown) => {
      const list = accounts as string[];
      if (list[0]) void bind(eth, list[0]);
      else disconnect();
    };
    eth.on?.("accountsChanged", onAccounts);
    return () => eth.removeListener?.("accountsChanged", onAccounts);
  }, [bind, disconnect]);

  const value = useMemo(
    () => ({ address, provider, ready, error, connect, disconnect }),
    [address, provider, ready, error, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
