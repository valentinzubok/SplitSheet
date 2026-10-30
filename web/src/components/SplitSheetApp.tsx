"use client";

import { useCallback, useEffect, useState } from "react";
import { CHAIN_ID, CONTRACT_ADDRESS, DEMO_INSTRUCTIONS, DEMO_SHEET, EXPLORER, GITHUB, txUrl } from "@/lib/config";
import {
  PAGE_SIZE,
  claim,
  expire,
  getBooks,
  getCredit,
  getRecentEvents,
  getRound,
  getSchedule,
  getSheet,
  getShares,
  listSheets,
  openSheet,
  split,
  withdrawCredit,
  withdrawFunder,
  type Books,
  type EventRow,
  type RoundRecord,
  type Schedule,
  type Sheet,
  type ShareRow,
} from "@/lib/contracts";
import { claimOutcome, creditOutcome, openOutcome, refundOutcome, roundOutcome, type Outcome } from "@/lib/outcome";
import { fundWithTestGen, getNativeBalance, type TxStage } from "@/lib/genlayer";
import { useWallet } from "./WalletProvider";

const short = (h: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : "—");
const utc = (seconds: number) =>
  seconds ? `${new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC` : "—";
const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;

/** Wei as GEN, trimmed: 1500000000000000000 -> "1.5". */
const fmtGen = (wei: string | number | undefined) => {
  let v: bigint;
  try {
    v = BigInt(wei || 0);
  } catch {
    return "0";
  }
  const whole = v / BigInt(10 ** 18);
  const frac = (v % BigInt(10 ** 18)).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.slice(0, 6)}` : `${whole}`;
};

/** GEN typed by a person as wei, or "" when it is not a number. */
const toWei = (text: string) => {
  const m = /^(\d+)(?:\.(\d{1,18}))?$/.exec(text.trim());
  if (!m) return "";
  return (BigInt(m[1]) * BigInt(10 ** 18) + BigInt((m[2] || "").padEnd(18, "0") || "0")).toString();
};

const STATUS: Record<string, string> = {
  open: "waiting for the first valid list",
  settling: "a list is proposed · not final",
  final: "list agreed · every payee can be paid",
  void: "void · the funder takes the escrow back",
};

const REASON: Record<string, string> = {
  shares_do_not_add_up: "the shares did not add up to exactly 100%",
  address_not_on_page: "an address was not written on the frozen page",
  duplicate_address: "an address appeared twice",
  bad_address: "an address was not a valid 0x address",
  bad_share: "a share was not a whole number of basis points",
  bad_row: "a row was not an address and a share",
  too_many_payees: "more payees than the sheet allows",
  no_list: "no list was found",
  model_says_unclear: "validators could not read a clear list",
  model_failed: "the model did not answer",
  not_json: "the model did not answer in JSON",
  not_object: "the model answer was not an object",
};

function Flow() {
  return (
    <div className="roundsbox" aria-hidden="true">
      <p className="q">Who gets what from the pot, according to the page the funder froze?</p>
      <div className="lane">
        <span>page</span>
        <span className="bar yes">frozen whole on chain when the money goes in</span>
      </div>
      <div className="lane">
        <span>round</span>
        <span className="bar yes">validators read a list · the code checks it</span>
      </div>
      <div className="lane">
        <span>check</span>
        <span className="bar no">every address on the page · shares add up to 100%</span>
      </div>
      <p className="gap">⋮ separated rounds must agree, before the deadline</p>
      <div className="lane">
        <span>result</span>
        <span className="bar final">each payee claims its share · or void</span>
      </div>
    </div>
  );
}

function Dots({ have, need }: { have: number; need: number }) {
  return (
    <span className="confirm" title={`${have} of ${need} agreeing rounds`}>
      {Array.from({ length: need }, (_, i) => (
        <i key={i} className={i < have ? "on" : ""} />
      ))}
    </span>
  );
}

function RoundView({ r }: { r: RoundRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <strong>
        round {r.round}: {r.finding}
      </strong>{" "}
      <span className="muted">
        ({r.outcome}
        {r.reason ? ` · ${REASON[r.reason] || r.reason}` : ""}) · {r.at_text} · page sha-256 {r.page_hash.slice(0, 12)}…{" "}
        <button className="ghost tiny" onClick={() => setOpen(!open)}>
          {open ? "hide the list" : "show the list this round read"}
        </button>
      </span>
      {open && (
        <div className="hashline" style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}>
          list hash {r.list_hash || "—"}
          {r.payees.length === 0 && "\n(no acceptable list in this round)"}
          {r.payees.map((p) => (
            <div key={p.address} style={{ marginTop: "0.3rem" }}>
              {p.address} · {pct(p.bps)}
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function SheetCard({
  s,
  sch,
  shares,
  rounds,
  me,
  disabled,
  onPick,
  onSplit,
  onExpire,
  onClaim,
  onRefund,
}: {
  s: Sheet;
  sch?: Schedule;
  shares: ShareRow[];
  rounds: RoundRecord[];
  me: string | null;
  disabled: boolean;
  onPick: () => void;
  onSplit: () => void;
  onExpire: () => void;
  onClaim: (who: string) => void;
  onRefund: () => void;
}) {
  const [showPage, setShowPage] = useState(false);
  const mine = !!me && s.funder.toLowerCase() === me.toLowerCase();
  return (
    <article className="card" style={{ marginTop: "1rem" }}>
      <div className="head">
        <span className="id">{s.sheet_id}</span>
        <span className="muted">
          {STATUS[s.status] || s.status} {s.rounds_required > 1 && <Dots have={s.standing.confirmations} need={s.rounds_required} />}
        </span>
      </div>
      <p>
        <button className="ghost tiny" onClick={onPick}>
          use this sheet above
        </button>
      </p>
      <p className="claimtext">{s.title}</p>
      <p className="hashline">
        funding {fmtGen(s.funding)} GEN · funder {short(s.funder)} · page <a href={s.sheet_url}>{s.sheet_url}</a>
      </p>
      <p className="hashline">
        unlocks {utc(s.unlock_at)} · settlement deadline {utc(s.deadline)} · {s.rounds_required} agreeing round
        {s.rounds_required === 1 ? "" : "s"} · at most {s.max_payees} payees
      </p>
      <p className="hashline">reading instructions: {s.instructions}</p>
      <p>
        <button className="ghost tiny" onClick={() => setShowPage(!showPage)}>
          {showPage ? "hide the frozen page" : `show the frozen page (${s.page.total_chars} chars, sha-256 ${s.page.content_hash.slice(0, 12)}…)`}
        </button>
      </p>
      {showPage && (
        <div className="hashline" style={{ whiteSpace: "pre-wrap" }}>
          {s.page.text}
        </div>
      )}
      {s.injection_flags.length > 0 && <p className="msg">Instruction-like phrasing was flagged on this sheet: {s.injection_flags.join(", ")}.</p>}
      {shares.length > 0 && (
        <div className="outcomes">
          {shares.map((r) => (
            <span key={r.address} className={`outcome ${r.claimed ? "final" : ""}`}>
              {short(r.address)}
              <small>
                {pct(r.bps)} · {fmtGen(r.amount)} GEN{r.claimed ? " · paid" : ""}
              </small>
              {!r.claimed && (
                <button className="ghost tiny" disabled={disabled} onClick={() => onClaim(r.address)}>
                  pay this share
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {rounds.length > 0 && (
        <ul className="timeline">
          {rounds.map((r) => (
            <RoundView key={r.round} r={r} />
          ))}
        </ul>
      )}
      {(s.status === "open" || s.status === "settling") && (
        <button className="ghost" disabled={disabled || (sch ? !sch.can_split : false)} onClick={onSplit}>
          {sch?.can_expire
            ? "deadline passed · only void is accepted"
            : sch && !sch.can_split
              ? `next round from ${utc(sch.next_round_at)}`
              : "run an extraction round"}
        </button>
      )}
      {sch?.can_expire && (
        <button className="ghost" style={{ marginLeft: "0.5rem" }} disabled={disabled} onClick={onExpire}>
          void the sheet
        </button>
      )}
      {mine && sch?.can_withdraw_funder && (
        <button className="ghost" style={{ marginLeft: "0.5rem" }} disabled={disabled} onClick={onRefund}>
          take the escrow back
        </button>
      )}
    </article>
  );
}

export function SplitSheetApp() {
  const { address, provider, connect, error: walletError } = useWallet();
  const [rows, setRows] = useState<Sheet[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [shares, setShares] = useState<Record<string, ShareRow[]>>({});
  const [rounds, setRounds] = useState<Record<string, RoundRecord[]>>({});
  const [books, setBooks] = useState<Books | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [credit, setCredit] = useState(BigInt(0));
  const [gen, setGen] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [err, setErr] = useState("");
  const [tx, setTx] = useState("");
  const [stage, setStage] = useState<TxStage | "">("");

  const [sid, setSid] = useState("harbor/release-1-2");
  const [title, setTitle] = useState("Harbor Release 1.2 pot");
  const [url, setUrl] = useState(DEMO_SHEET);
  const [instructions, setInstructions] = useState(DEMO_INSTRUCTIONS);
  const [unlockIn, setUnlockIn] = useState("120");
  const [settleWindow, setSettleWindow] = useState("900");
  const [roundsReq, setRoundsReq] = useState("1");
  const [interval, setIntervalSeconds] = useState("60");
  const [maxPayees, setMaxPayees] = useState("5");
  const [fundingGen, setFundingGen] = useState("2");

  const loadSheets = useCallback(async (count: number) => {
    // Newest first, one page at a time: the console never reads the whole registry.
    const first = await listSheets(0, 1);
    const n = first.total;
    setTotal(n);
    const start = Math.max(0, n - count);
    const page = await listSheets(start, Math.min(count, n));
    const ids = page.items.map((x) => x[0]).reverse();
    const sheets = (await Promise.all(ids.map((id) => getSheet(id)))).filter(Boolean) as Sheet[];
    setRows(sheets);
    setLoaded(ids.length);
    const sc = await Promise.all(ids.map((id) => getSchedule(id)));
    setSchedules(Object.fromEntries(sc.filter(Boolean).map((x) => [(x as Schedule).sheet_id, x as Schedule])));
    const sh = await Promise.all(ids.map((id) => getShares(id)));
    setShares(Object.fromEntries(ids.map((id, i) => [id, sh[i]])));
    const rs = await Promise.all(
      sheets.map(async (s) => (await Promise.all(Array.from({ length: s.rounds }, (_, i) => getRound(s.sheet_id, i + 1)))).filter(Boolean) as RoundRecord[]),
    );
    setRounds(Object.fromEntries(sheets.map((s, i) => [s.sheet_id, rs[i]])));
  }, []);

  const refresh = useCallback(
    async (count = Math.max(PAGE_SIZE, loaded)) => {
      setLoading(true);
      try {
        const [ev, b] = await Promise.all([getRecentEvents(10), getBooks()]);
        setBooks(b);
        setEvents(ev);
        await loadSheets(count);
        if (address) {
          setGen(await getNativeBalance(address));
          setCredit(await getCredit(address));
        } else {
          setCredit(BigInt(0));
        }
      } catch (e) {
        setErr(`Error: ${e instanceof Error ? e.message : "read failed"}`);
      } finally {
        setLoading(false);
      }
    },
    [address, loadSheets, loaded],
  );

  useEffect(() => {
    void refresh(PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const onStage = (next: TxStage, hash: string) => {
    setTx(hash);
    setStage(next);
    if (next === "finalized") void refresh();
  };

  /** Send, then decide success from chain state - never from the receipt alone. */
  const run = async (name: string, fn: () => Promise<string | void>, check?: () => Promise<Outcome>) => {
    if (!address || !provider) {
      setErr("Connect MetaMask for writes");
      return;
    }
    setBusy(name);
    setErr("");
    setOutcome(null);
    setStage("");
    try {
      const hash = await fn();
      if (hash) setTx(hash);
      if (check) setOutcome(await check());
      await refresh();
    } catch (e) {
      setErr(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
    }
  };

  const acct = address as `0x${string}`;
  const disabled = !!busy || !address;
  const fundingWei = toWei(fundingGen);

  const doOpen = () => {
    const before = credit;
    void run(
      "open_sheet",
      () => openSheet(acct, provider, { id: sid, title, url, instructions, unlockIn, settleWindow, rounds: roundsReq, interval, maxPayees, funding: fundingWei }, onStage),
      async () => openOutcome(await getSheet(sid), acct, before, await getCredit(acct), BigInt(fundingWei || "0")),
    );
  };

  const doSplit = (s: Sheet) => {
    const before = s.rounds;
    void run(
      "split",
      () => split(acct, provider, s.sheet_id, onStage),
      async () => {
        const fresh = await getSheet(s.sheet_id);
        return roundOutcome(before, fresh ? await getRound(s.sheet_id, fresh.rounds) : null);
      },
    );
  };

  const doClaim = (s: Sheet, who: string) =>
    void run(
      "claim",
      () => claim(acct, provider, s.sheet_id, who, onStage),
      async () => claimOutcome((await getShares(s.sheet_id)).find((r) => r.address === who.toLowerCase())),
    );

  const doRefund = (s: Sheet) =>
    void run(
      "withdraw_funder",
      () => withdrawFunder(acct, provider, s.sheet_id, onStage),
      async () => refundOutcome(!!(await getSheet(s.sheet_id))?.refunded),
    );

  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <h1>
            Split<span className="accent">Sheet</span>
          </h1>
          <p className="lede">
            Splitting a pot usually means one person types the numbers. Here the funder publishes the
            split as a page; the page is <strong>frozen whole on chain</strong> when the money goes
            in, validators read the list of payees out of it, and the <strong>contract checks the list
            itself</strong>: every address must be written on the page, shares must add up to exactly
            100%. Separated rounds must agree before anyone can be paid.
          </p>
          <div className="chips">
            <span className="chip">
              chain <b>{CHAIN_ID}</b>
            </span>
            <span className="chip">
              sheets <b>{total}</b>
            </span>
            {books && (
              <span className="chip">
                held now <b>{fmtGen(books.balance)} GEN</b>
              </span>
            )}
          </div>
          <p className="muted" style={{ marginTop: "0.8rem" }}>
            Contract <a href={EXPLORER}>{short(CONTRACT_ADDRESS, 12)}</a> · nobody is privileged ·{" "}
            <a href={GITHUB}>source</a>
          </p>
          <div>
            {!address ? (
              <button onClick={() => void connect()}>Connect MetaMask</button>
            ) : (
              <span className="pill">
                <span className="dot" /> {short(address)} · {gen || "?"} GEN
              </span>
            )}
            {address && (
              <button
                className="ghost"
                style={{ marginLeft: "0.5rem" }}
                disabled={!!busy}
                onClick={() =>
                  void run("Get test GEN", async () => {
                    await fundWithTestGen(acct);
                  })
                }
              >
                Get test GEN
              </button>
            )}
          </div>
          {address && credit > BigInt(0) && (
            <p className="verdictbox">
              The contract holds <strong>{fmtGen(credit.toString())} GEN</strong> for you from a sheet it
              refused.{" "}
              <button
                className="ghost tiny"
                disabled={!!busy}
                onClick={() => {
                  const before = credit;
                  void run("withdraw_credit", () => withdrawCredit(acct, provider, onStage), async () => creditOutcome(before, await getCredit(acct)));
                }}
              >
                take it back
              </button>
            </p>
          )}
          {outcome && (
            <p className={outcome.verdict === "done" ? "okmsg" : "msg"}>
              <strong>{outcome.title}.</strong> {outcome.detail}
            </p>
          )}
          {walletError && <p className="msg">{walletError}</p>}
          {err && <p className="msg">{err}</p>}
          {tx && (
            <p className="tx muted">
              last tx <a href={txUrl(tx)}>{short(tx, 14)}</a>{" "}
              {stage === "finalized" ? (
                <span className="stagepill final">finalized · payouts have landed</span>
              ) : (
                <span className="stagepill accepted">accepted — awaiting finalization</span>
              )}
            </p>
          )}
        </div>
        <Flow />
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Before you rely on a sheet: what is fixed, and what you trust</h2>
        <ul className="decide">
          <li>
            <span className="tag">the page</span> is stored on chain whole (at most 3000 characters,
            so validators read all of it). Edits to the live page afterwards change nothing; open a
            sheet to read the exact text.
          </li>
          <li>
            <span className="tag">the check</span> a list counts only if every payee address is
            written on the frozen page, addresses are unique and shares are whole basis points adding
            up to exactly 10000. The model proposes, the contract accepts.
          </li>
          <li>
            <span className="tag">the funder</span> chooses the page and the reading. You trust that
            the page says what you were promised; you can read it before the money is touched. The
            funder cannot change anything or withdraw while the sheet is live.
          </li>
          <li>
            <span className="tag">the deadline</span> rounds are accepted only before the sheet&apos;s
            deadline; from the deadline on, only void, which returns the escrow to the funder.
          </li>
        </ul>
      </section>

      <div className="row">
        <section className="card">
          <h2>Open a sheet</h2>
          <label htmlFor="sid">Sheet id</label>
          <input id="sid" value={sid} onChange={(e) => setSid(e.target.value)} />
          <label htmlFor="title">Title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label htmlFor="url">Page with the split (https, at most 3000 characters)</label>
          <input id="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          <label htmlFor="how">How to read the page</label>
          <textarea id="how" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          <div className="grid2">
            <div>
              <label htmlFor="funding">Funding (GEN, at least 1)</label>
              <input id="funding" value={fundingGen} onChange={(e) => setFundingGen(e.target.value)} />
            </div>
            <div>
              <label htmlFor="maxp">Most payees (1–20)</label>
              <input id="maxp" value={maxPayees} onChange={(e) => setMaxPayees(e.target.value)} />
            </div>
            <div>
              <label htmlFor="unlock">Unlocks in (s)</label>
              <input id="unlock" value={unlockIn} onChange={(e) => setUnlockIn(e.target.value)} />
            </div>
            <div>
              <label htmlFor="win">Settlement window (s)</label>
              <input id="win" value={settleWindow} onChange={(e) => setSettleWindow(e.target.value)} />
            </div>
            <div>
              <label htmlFor="interval">Interval between rounds (s)</label>
              <input id="interval" value={interval} onChange={(e) => setIntervalSeconds(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rounds">Agreeing rounds (1–3)</label>
              <input id="rounds" value={roundsReq} onChange={(e) => setRoundsReq(e.target.value)} />
            </div>
          </div>
          <button disabled={disabled || !sid || !title || !url || fundingWei === ""} onClick={doOpen}>
            {busy === "open_sheet" ? (
              <span className="working">
                <span className="spinner" /> validators are freezing the page…
              </span>
            ) : (
              `escrow ${fundingGen || "0"} GEN and freeze the page`
            )}
          </button>
        </section>

        <section className="card">
          <h2>How a payout happens</h2>
          <ol className="decide">
            <li>Open a sheet: the page is frozen and the funding escrowed.</li>
            <li>After the unlock time anyone runs an extraction round. A valid list is proposed.</li>
            <li>Rounds a full interval apart must produce the same list. A different list restarts the count; an unacceptable one moves nothing and is kept as evidence.</li>
            <li>Once final, anyone can pay any payee its share; the money always goes to the payee.</li>
            <li>No agreement before the deadline: anyone voids the sheet and the funder takes the escrow back.</li>
          </ol>
          <p className="muted">
            Anything the contract refuses (unreadable or oversized page, funding below 1 GEN, a taken
            id) is shown as &quot;NOT opened&quot; with your credit and a button to take it back.
          </p>
        </section>
      </div>

      <section style={{ marginTop: "2rem" }}>
        <div className="head">
          <h2>Sheets on chain (newest first)</h2>
          <button className="ghost" disabled={loading} onClick={() => void refresh()}>
            {loading ? "reading…" : "refresh"}
          </button>
        </div>
        {rows.length === 0 && !loading && <p className="muted">No sheets yet.</p>}
        {rows.map((s) => (
          <SheetCard
            key={s.sheet_id}
            s={s}
            sch={schedules[s.sheet_id]}
            shares={shares[s.sheet_id] || []}
            rounds={rounds[s.sheet_id] || []}
            me={address}
            disabled={disabled}
            onPick={() => setSid(s.sheet_id)}
            onSplit={() => doSplit(s)}
            onExpire={() => void run("expire", () => expire(acct, provider, s.sheet_id, onStage))}
            onClaim={(who) => doClaim(s, who)}
            onRefund={() => doRefund(s)}
          />
        ))}
        {loaded < total && (
          <button className="ghost" style={{ marginTop: "1rem" }} disabled={loading} onClick={() => void refresh(loaded + PAGE_SIZE)}>
            load {Math.min(PAGE_SIZE, total - loaded)} older sheets ({total - loaded} not shown)
          </button>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Recent events</h2>
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          <ul className="timeline">
            {events.map((e) => (
              <li key={e.n}>
                <strong>{String(e.event)}</strong>{" "}
                <span className="muted">
                  {[e.sheet_id, e.round ? `round ${e.round}` : null, e.finding, e.outcome, e.funding ? `${fmtGen(String(e.funding))} GEN` : null, e.amount ? `${fmtGen(String(e.amount))} GEN` : null]
                    .filter(Boolean)
                    .map(String)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="foot">
        SplitSheet on GenLayer Studio Dev (chain {CHAIN_ID}). Reads work without a wallet; writes need
        MetaMask and test GEN. The demo sheet pages are files in this repository.
      </footer>
    </main>
  );
}
