# SplitSheet

<p align="center">
  <img src="assets/logo.png" alt="SplitSheet" width="120" />
</p>

<p align="center">
  <strong>A payout split nobody edits: the page is frozen on chain, validators read the list, the contract checks it.</strong>
</p>

<p align="center">
  <a href="https://valentinzubok.github.io/SplitSheet/"><img src="https://img.shields.io/badge/Live-Console-34d399?style=flat-square" alt="Live console" /></a>
  <a href="https://github.com/valentinzubok/SplitSheet/actions/workflows/ci.yml"><img src="https://github.com/valentinzubok/SplitSheet/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/GenLayer-Studio%20Dev%2061997-34d399?style=flat-square" alt="Studio Dev" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT" /></a>
</p>

---

## The trust problem

Splitting a pot between contributors usually means one person types the numbers, and everyone
else trusts that person. A model that reads a contributors table does not fix that by itself:
it can invent an address, rescale shares until they "work", or follow instructions hidden in the
page.

**SplitSheet makes the split a published page and the payout a consensus question, but the model
never decides.** The funder escrows the pot and names a page. The page is stored **whole on chain**
when the money goes in. Validators read a list of payees and shares out of that frozen text; the
contract accepts the list only if its own checks pass. Separated rounds must produce the same list.

```
open_sheet(sheet_id, title, sheet_url, instructions, unlock_in, settle_window,
           rounds_required, round_interval, max_payees)             PAYABLE, >= 1 GEN
split(sheet_id)        anyone, from unlock_at and strictly BEFORE the deadline,
                       a full round_interval after the previous round
                         valid list, same hash as the standing proposal -> one more confirmation
                         a different valid list                         -> the count restarts at 1
                         invalid or unclear                             -> nothing moves, round kept
                       rounds_required agreeing rounds -> FINAL
expire(sheet_id)       anyone, AT or after the deadline, if not final: VOID
claim(sheet_id, payee) anyone, for a payee of a FINAL list: pays that payee its share
withdraw_funder        the funder, once VOID
withdraw_credit        take back what a payable call refused to escrow
get_round(sheet_id, n) everything a round saw and decided, kept for good
list_sheets(offset, limit) / get_events(offset, limit)   paged, no global cap
```

## What a payee can check before relying on a sheet

| Question | Answer |
|---|---|
| What exactly was the list read from? | The whole page, in `get_sheet(...).page.text`, with its SHA-256. A page longer than 3000 characters is refused when the sheet opens, so validators always read all of it. Editing the live page afterwards changes nothing. |
| Can the model invent a payee? | No. Every address must be written on the frozen page (checked in code, case-insensitive), addresses must be unique, every share is a whole number of basis points (1% = 100) and the shares add up to exactly 10000. Anything else is `invalid` and moves nothing. |
| Can one lucky reading pay? | `rounds_required` (1–3) rounds, a full interval apart, must produce the **same list hash**. A different valid list restarts the count. |
| Can the funder change the list, the schedule or take the money back? | No setters, no owner. The funder can only take the escrow back from a **void** sheet (nobody agreed before the deadline). |
| Can transaction order choose between a payout and a refund? | No. `split` works only before the deadline and `expire` only at or after it; `get_schedule` never offers both. |
| What if the page is instruction-bait? | Page and reading instructions are fenced as untrusted data, instruction-like phrasing is flagged and stored with every round. Even a followed instruction cannot pay an address that is not on the page or break the 100% rule. |
| What is lost if validators cannot read a clear list? | Nothing. An `unclear` or `invalid` round is stored as evidence and the sheet can still reach the deadline and be voided. |
| Can the registry fill up? | No cap. Sheets, rounds and events live in `TreeMap`s with a `DynArray` index; a sheet costs at least 1 GEN; lists are paged. |
| A refused call that swallows money? | Payable calls never raise once value is attached: what cannot be escrowed becomes a credit and `withdraw_credit` pays it back. |

**What you still trust:** that the page says what you were promised. The funder chooses it. Read
the frozen text in the console before the money is touched; it is exactly what will be read.

## Live

| | |
|---|---|
| Console | **https://valentinzubok.github.io/SplitSheet/** (reads work with no wallet) |
| Network | GenLayer Studio Dev / Studio Next — chain `61997` |
| Contract | [`0x7D4d47a34f29409617bd08dAc7818eE22fFC349E`](https://explorer-studio-dev.genlayer.com/address/0x7D4d47a34f29409617bd08dAc7818eE22fFC349E) — CI checks the deployed code equals [`contracts/SplitSheet.py`](contracts/SplitSheet.py) |
| Deploy record | [`STUDIO_DEV_DEPLOY.md`](STUDIO_DEV_DEPLOY.md) — every transaction of the demo, including the refused ones |

## Demo sheet pages

Files in this repository, read from `raw.githubusercontent.com`:
[`release-1-2.md`](web/public/fixtures/sheets/release-1-2.md) (50 / 30 / 20 %, the sheet the demo pays),
[`bad-sum.md`](web/public/fixtures/sheets/bad-sum.md) (shares add up to 90 %, never acceptable) and
[`long.md`](web/public/fixtures/sheets/long.md) (longer than 3000 characters, refused when opening).

## Lint

`sh scripts/lint_current_sdk.sh` runs the official GenVM linter (`lint`, `check`, `typecheck`); CI
runs it on every push. Every refusal raises `gl.vm.UserError`; every method takes `self`.

## The console

[`web/`](web/) — Next.js 16 + `genlayer-js` + MetaMask, static export to Pages. It shows the trust
card before any money moves, the frozen page, every round with the list it read, and the deadline.
Success is decided by reading the contract **after** the call ([`outcome.ts`](web/src/lib/outcome.ts)):
a refused sheet is shown as "NOT opened" with the credit and a button to take it back.

```bash
cd web && npm install
npm test        # 15 tests
npm run dev     # http://localhost:3021
```

## Tests

```bash
pip install -r requirements-dev.txt
python3 -m pytest -q      # 75 tests
```

[`tests/test_splitsheet.py`](tests/test_splitsheet.py): the list check (13 unacceptable lists, a made-up
address, unclear and broken model answers, a forged consensus answer), rounds (restart, interval,
unlock), the deadline boundary (one second before, at, after; competing calls; the schedule at every
second), claims and refunds, evidence kept per round, no registry cap, refused payables credited, the
fencing of injected text, and the books balancing through a 220-step random run.

## License

[MIT](LICENSE) © 2026 Valentyn Zubok
