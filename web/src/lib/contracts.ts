import { CONTRACT_ADDRESS } from "./config";
import { type Address, type TxStage, parseJson, readContract, writeAndWait } from "./genlayer";

export type Payee = { address: string; bps: number };

export type Sheet = {
  sheet_id: string;
  funder: string;
  title: string;
  sheet_url: string;
  instructions: string;
  funding: string;
  created_at: number;
  unlock_at: number;
  deadline: number;
  rounds_required: number;
  round_interval: number;
  max_payees: number;
  status: "open" | "settling" | "final" | "void";
  page: { text: string; content_hash: string; total_chars: number; frozen_at: number };
  injection_flags: string[];
  standing: { list_hash: string; payees: Payee[]; confirmations: number };
  rounds: number;
  last_round_at: number;
  final_list: Payee[];
  final_at: number;
  claimed: Record<string, string>;
  paid_out: string;
  refunded: boolean;
};

export type RoundRecord = {
  sheet_id: string;
  round: number;
  at: number;
  at_text: string;
  by: string;
  page_hash: string;
  finding: "list" | "invalid" | "unclear";
  reason: string;
  list_hash: string;
  payees: Payee[];
  outcome: "proposed" | "confirmed" | "restarted" | "final" | "no_progress";
  confirmations: number;
  status_after: string;
  injection_flags: string[];
};

export type ShareRow = { address: string; bps: number; amount: string; claimed: boolean };
export type Schedule = {
  sheet_id: string;
  now: number;
  status: string;
  unlock_at: number;
  deadline: number;
  next_round_at: number;
  can_split: boolean;
  can_expire: boolean;
  can_claim: boolean;
  can_withdraw_funder: boolean;
  rounds: number;
  confirmations: number;
  rounds_required: number;
};
export type Books = { balance: string; held: string; credits: string };
export type EventRow = { event: string; n: number; [key: string]: unknown };
export type PageOf<T> = { total: number; offset: number; items: T[] };

type OnStage = (stage: TxStage, hash: string) => void;
const read = (fn: string, args: (string | number)[] = []) =>
  readContract<string>(CONTRACT_ADDRESS, fn, args as never[]);

export const PAGE_SIZE = 20;

/** One page of [sheet_id, status]. Never the whole registry. */
export async function listSheets(offset: number, limit = PAGE_SIZE): Promise<PageOf<[string, string]>> {
  return parseJson(await read("list_sheets", [offset, limit]), { total: 0, offset, items: [] });
}
export async function getSheet(id: string): Promise<Sheet | null> {
  try {
    const s = parseJson<Sheet>(await read("get_sheet", [id]), {} as Sheet);
    return s.sheet_id ? s : null;
  } catch {
    return null;
  }
}
export async function getShares(id: string): Promise<ShareRow[]> {
  const r = parseJson<{ shares?: ShareRow[] }>(await read("get_shares", [id]), {});
  return r.shares || [];
}
export async function getSchedule(id: string): Promise<Schedule | null> {
  const s = parseJson<Schedule>(await read("get_schedule", [id]), {} as Schedule);
  return s.sheet_id ? s : null;
}
export async function getRound(id: string, n: number): Promise<RoundRecord | null> {
  try {
    const r = parseJson<RoundRecord>(await read("get_round", [id, n]), {} as RoundRecord);
    return r.sheet_id ? r : null;
  } catch {
    return null;
  }
}
export async function getBooks(): Promise<Books | null> {
  return parseJson<Books | null>(await read("get_balance"), null);
}
/** The newest events: the last page of the paged event log. */
export async function getRecentEvents(count = 10): Promise<EventRow[]> {
  const head = parseJson<PageOf<EventRow>>(await read("get_events", [0, 1]), { total: 0, offset: 0, items: [] });
  const start = Math.max(0, head.total - count);
  const page = parseJson<PageOf<EventRow>>(await read("get_events", [start, count]), { total: 0, offset: 0, items: [] });
  return page.items.slice().reverse();
}
export async function getCredit(address: string): Promise<bigint> {
  try {
    return BigInt((await read("get_credit", [address])) || "0");
  } catch {
    return BigInt(0);
  }
}

export type NewSheet = {
  id: string;
  title: string;
  url: string;
  instructions: string;
  unlockIn: string;
  settleWindow: string;
  rounds: string;
  interval: string;
  maxPayees: string;
  /** Funding in wei; it travels as the transaction's value. */
  funding: string;
};

export async function openSheet(account: Address, provider: unknown, p: NewSheet, on?: OnStage) {
  return writeAndWait(
    account,
    provider,
    CONTRACT_ADDRESS,
    "open_sheet",
    [p.id, p.title, p.url, p.instructions, p.unlockIn, p.settleWindow, p.rounds, p.interval, p.maxPayees],
    on,
    BigInt(p.funding || "0"),
  );
}

const simple = (fn: string) => (account: Address, provider: unknown, id: string, on?: OnStage) =>
  writeAndWait(account, provider, CONTRACT_ADDRESS, fn, [id], on);
export const split = simple("split");
export const expire = simple("expire");
export const withdrawFunder = simple("withdraw_funder");

export async function claim(account: Address, provider: unknown, id: string, payee: string, on?: OnStage) {
  return writeAndWait(account, provider, CONTRACT_ADDRESS, "claim", [id, payee], on);
}

export async function withdrawCredit(account: Address, provider: unknown, on?: OnStage) {
  return writeAndWait(account, provider, CONTRACT_ADDRESS, "withdraw_credit", [], on);
}
