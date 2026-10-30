import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import type { CalldataEncodable } from "genlayer-js/types";
import { TransactionStatus } from "genlayer-js/types";
import { EXPLORER_BASE, RPC_URL } from "./config";

export type Address = `0x${string}`;

type EthereumProvider = NonNullable<Parameters<typeof createClient>[0]>["provider"];

/**
 * GenLayer Studio Dev (61997). Built on the SDK's `studioDevnet` definition so the
 * consensus contracts, `isStudio` flag and fee policy match the chain; only the
 * RPC / explorer URLs are overridable.
 */
export const studioNext = {
  ...studioDevnet,
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Studio Dev Explorer", url: EXPLORER_BASE } },
} as typeof studioDevnet;

/**
 * Studio Dev rate-limits at ~30 requests/minute per IP. Every read goes through one
 * serialized queue with a minimum spacing, and a rate-limited call backs off and retries
 * instead of surfacing "Rate limit exceeded" to the user.
 */
const MIN_SPACING_MS = 250;
let queue: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimited(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /rate limit|-32429|too many requests/i.test(msg);
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fn();
      } catch (e) {
        if (attempt >= 4 || !isRateLimited(e)) throw e;
        await sleep(1500 * (attempt + 1));
      }
    }
  }) as Promise<T>;
  queue = run.then(() => sleep(MIN_SPACING_MS)).catch(() => sleep(MIN_SPACING_MS));
  return run;
}

export function getReadClient() {
  return createClient({ chain: studioNext });
}

export function getWriteClient(account: Address, provider: EthereumProvider) {
  return createClient({ chain: studioNext, account, provider });
}

export async function readContract<T = unknown>(
  address: Address,
  functionName: string,
  args: CalldataEncodable[] = [],
): Promise<T> {
  const client = getReadClient();
  return enqueue(() => client.readContract({ address, functionName, args }) as Promise<T>);
}

/**
 * A Studio Dev transaction reaches ACCEPTED first (the leader's result was agreed) and
 * FINALIZED later (the appeal window closed). The two are different guarantees, so the
 * caller is told about each one instead of treating acceptance as completion.
 */
export type TxStage = "accepted" | "finalized";

export async function writeAndWait(
  account: Address,
  provider: unknown,
  address: Address,
  functionName: string,
  args: CalldataEncodable[] = [],
  onStage?: (stage: TxStage, hash: string) => void,
  value: bigint = BigInt(0),
): Promise<string> {
  const client = getWriteClient(account, provider as EthereumProvider);
  // Studio Dev enforces the fee system: every tx must carry a non-zero fee deposit.
  const fees = await client.estimateTransactionFees({});
  const hash = await client.writeContract({
    address,
    functionName,
    args,
    // GEN sent to a payable method. Separate from the fee deposit below.
    value,
    fees,
  });
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
    interval: 3000,
  });
  onStage?.("accepted", hash);
  // Finalization is a separate, slower guarantee; the UI keeps showing "accepted" until
  // it lands, and a finalization that never arrives is reported rather than assumed.
  void waitForFinalized(hash).then((ok) => {
    if (ok) onStage?.("finalized", hash);
  });
  return hash;
}

/** Poll the transaction until the chain reports FINALIZED. Returns false on timeout. */
export async function waitForFinalized(hash: string, attempts = 80): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const tx = await rpcOnce<{ status?: string }>("eth_getTransactionByHash", [hash]);
      if (String(tx?.status || "").toUpperCase() === "FINALIZED") return true;
    } catch {
      // transient RPC failure: keep polling
    }
    await sleep(4000);
  }
  return false;
}

export async function getTxStatus(hash: string): Promise<string> {
  const tx = await rpc<{ status?: string }>("eth_getTransactionByHash", [hash]);
  return String(tx?.status || "unknown").toUpperCase();
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  return enqueue(() => rpcOnce<T>(method, params));
}

async function rpcOnce<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || `${method} failed`);
  return body.result as T;
}

/** Studio faucet: tops up the connected wallet with test GEN for tx fees. */
export async function fundWithTestGen(address: Address, gen = 100): Promise<void> {
  // 100 * 1e18 is exactly representable as a JS number; the RPC expects a JSON number.
  await rpc("sim_fundAccount", [address, gen * 1e18]);
}

export async function getNativeBalance(address: Address): Promise<string> {
  const wei = BigInt(await rpc<string>("eth_getBalance", [address, "latest"]));
  return (wei / BigInt(10) ** BigInt(18)).toString();
}

export function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
