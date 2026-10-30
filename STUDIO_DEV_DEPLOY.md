# SplitSheet — Studio Dev (chain 61997) deploy record

| | |
|---|---|
| **Network** | GenLayer Studio Dev / Studio Next — chain `61997` |
| **Contract** | [`0x7D4d47a34f29409617bd08dAc7818eE22fFC349E`](https://explorer-studio-dev.genlayer.com/address/0x7D4d47a34f29409617bd08dAc7818eE22fFC349E) |
| **Deploy tx** | [`0xa5f8c39d…b5606d`](https://explorer-studio-dev.genlayer.com/tx/0xa5f8c39d7418cd915e0878dfa7d2cefff2736b98af4f6f29730f248d4bb5606d) from `0x5f1C2ba2119001151cc3942A7B7a284bE22565b9`, which has no role in the contract |
| **Source** | [`contracts/SplitSheet.py`](contracts/SplitSheet.py) — runner `py-genlayer:babwp9t37jw9g4j2bccgn14g6x7x9s1f7dsmh7emvz735pz4zxa0` |
| **Source sha256** | `3cb41abba12c6fbc327b8bcd15994ca6c8ef03331457a3cb71d184dcd30a70af` |

## Verify the source yourself

```bash
curl -s -X POST https://studio-dev.genlayer.com/api -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"gen_getContractCode","params":["0x7D4d47a34f29409617bd08dAc7818eE22fFC349E"]}' \
  | python3 -c "import sys,json,base64,hashlib; print(hashlib.sha256(base64.b64decode(json.load(sys.stdin)['result'])).hexdigest())"
shasum -a 256 contracts/SplitSheet.py
# both print 3cb41abba12c6fbc327b8bcd15994ca6c8ef03331457a3cb71d184dcd30a70af
```

CI runs the same comparison on every push (`scripts/verify_deployment.py`).

## Runner

Studio Dev stopped accepting the earlier runner `py-genlayer:5jycge4q8…` between 2026-10-20 and
2026-10-30 (`invalid_contract runner malformed`, also for contracts deployed earlier). This contract
uses the runner listed as current on the [official runners page](https://sdk.genlayer.com/main/executors/v0.3/python-sdk/available-runners.html)
(GenVM v0.3.0-rc10). Three deploys with older runners failed before it, which is why the deployer
account has failed transactions in the explorer.

## Lint

`sh scripts/lint_current_sdk.sh` — `genvm-lint lint` on the file as deployed, then `check` and `typecheck`
on a copy whose header uses the runner bundled with the public linter (`1jb45aa8…`, GenVM rc7); the
linter cannot yet download the rc10 runner. The contract body is byte-identical. Passed, in CI.

## The run

Accounts (throwaway test keys): funder `0xA468fEf094FF413555Bc1025dBF10A3334fF7BC3`, stranger
`0x3F1ba839a1Aff90015d958Ec0C1Dc897bB5C9bB0`, payees Ada `0xDfB9eA20…6d36`, Grace `0x4e34281b…B43d`,
Linus `0xa7DbD986…221A` (listed on the demo page). Sheet pages are files of this repository, read from
`raw.githubusercontent.com`.

| # | Call | Sender | Result | What happened | Tx |
|---|------|--------|--------|---------------|----|
| 1 | `open_sheet(good-1)` value 4 GEN | funder | SUCCESS | `good-1`: 4 GEN, page `release-1-2.md` (50 / 30 / 20 %), 2 agreeing rounds, unlock +60 s, interval 60 s. The page is frozen whole on chain. | [`0x83674212…b7b1d3`](https://explorer-studio-dev.genlayer.com/tx/0x83674212d251f6fa1375528afd628bf8b6851077a0884bdab5dc11e26bb7b1d3) |
| 2 | `open_sheet(bad-1)` value 2 GEN | funder | SUCCESS | `bad-1`: 2 GEN, page `bad-sum.md` (a draft, shares add up to 90 %), 1 round. | [`0xffed76b3…1e6082`](https://explorer-studio-dev.genlayer.com/tx/0xffed76b3f60ff79e690272daf8b66d410e61792be891e547588bfdda271e6082) |
| 3 | `open_sheet(long-1)` value 3 GEN | funder | SUCCESS | `long-1`: 3 GEN, page `long.md` (4 986 characters > 3000) → refused in the return value, 3 GEN credited. | [`0x4911faf0…9e9516`](https://explorer-studio-dev.genlayer.com/tx/0x4911faf0331c52486ad9c27d3d800bc5f0b9bf120a3d516a3c42c92b3c9e9516) |
| 4 | `open_sheet(dust-1)` value 0.5 GEN | funder | SUCCESS | `dust-1`: 0.5 GEN → refused (minimum 1 GEN), 0.5 GEN credited. Credit read back: 3.5 GEN. | [`0x3a477f97…18fa9f`](https://explorer-studio-dev.genlayer.com/tx/0x3a477f97055df9f32f9740637453902731dcb082f00ac3b0333067784118fa9f) |
| 5 | `split(good-1)` | stranger | **ERROR** | `good-1` before unlock: **UserError** `the sheet unlocks at 1793366125` | [`0xf6327ea5…ad4233`](https://explorer-studio-dev.genlayer.com/tx/0xf6327ea57de3a040eee0b272812084440354ff616c4189621f18e941c0ad4233) |
| 6 | `split(good-1)` | stranger | SUCCESS | `good-1` round 1: validators read the table → list proposed (Ada 5000, Grace 3000, Linus 2000 bps), 1 of 2 | [`0x5699ef06…086c19`](https://explorer-studio-dev.genlayer.com/tx/0x5699ef06a711dd4a7db88365f0cbaa9dcd31c49d5f06ddd961d2972d35086c19) |
| 7 | `split(good-1)` | stranger | **ERROR** | `good-1` again inside the interval: **UserError** `the next round opens at 1793366201` | [`0x4b046932…3045ec`](https://explorer-studio-dev.genlayer.com/tx/0x4b046932f78e26cb7ba62a4c90b4f74cbcc43173e3d09b2437ede3ead63045ec) |
| 8 | `split(bad-1)` | stranger | SUCCESS | `bad-1` round 1: validators found no acceptable list on the draft → finding `invalid` (`no_list`), nothing proposed, round kept | [`0x3036941e…e29a15`](https://explorer-studio-dev.genlayer.com/tx/0x3036941ee2e54b9c0007319aa2a146ad175bbcd1f7992fd01746bbdc57e29a15) |
| 9 | `split(good-1)` | stranger | SUCCESS | `good-1` round 2: same list hash → **final** | [`0x3ae476c5…94e87e`](https://explorer-studio-dev.genlayer.com/tx/0x3ae476c513ec92608e2f482646e98fdcf4f8cd8253700953dc7949ab9194e87e) |
| 10 | `claim(good-1)` | stranger | SUCCESS | FINALIZED. claim Ada: 2 GEN | [`0xa042450b…38458c`](https://explorer-studio-dev.genlayer.com/tx/0xa042450b49ff9ed30589ecfb92378b566a867fcaf9bd1f651eb9a310b938458c) |
| 11 | `claim(good-1)` | stranger | SUCCESS | FINALIZED. claim Grace: 1.2 GEN | [`0x1828a1db…5a8511`](https://explorer-studio-dev.genlayer.com/tx/0x1828a1db7f0e025164c2af4786ee6645f5dd0dc73e6307d0bc2575f88c5a8511) |
| 12 | `claim(good-1)` | stranger | SUCCESS | FINALIZED. claim Linus: 0.8 GEN | [`0x6152ded9…eef19a`](https://explorer-studio-dev.genlayer.com/tx/0x6152ded94c245a3259edb0b26eb23b4420e22ee5d37b825a17fb244442eef19a) |
| 13 | `claim(good-1)` | stranger | **ERROR** | claim Ada again: **UserError** `this share was already paid` | [`0x4e38b60c…5f55ab`](https://explorer-studio-dev.genlayer.com/tx/0x4e38b60c6766ce3c2d9a4f493dfc0a821953b18e80185530c79d81d4215f55ab) |
| 14 | `claim(good-1)` | stranger | **ERROR** | claim for an address that is not on the list: **UserError** `that address is not on the final list` | [`0x9e769511…f54f74`](https://explorer-studio-dev.genlayer.com/tx/0x9e76951169ded844b1c735c234c69fbdd63eaf8d09308f16b14739cfd0f54f74) |
| 15 | `expire(bad-1)` | stranger | SUCCESS | `expire(bad-1)`: by now `bad-1`'s deadline (1793366370) had passed, so it became VOID (see the note below about tx 16–18) | [`0xadb7b705…0a76e7`](https://explorer-studio-dev.genlayer.com/tx/0xadb7b705a416e01baef8ab482b26c35d3e3af908b92d504d206d8ddfe90a76e7) |
| 16 | `split(bad-1)` | stranger | **ERROR** | `split(bad-1)` on the already void sheet: **UserError** `the sheet is settled` | [`0xca15d6e5…aeb3d2`](https://explorer-studio-dev.genlayer.com/tx/0xca15d6e58aeaf29b9ff9d07b86cef67ed5c2146efddcf0ebe378f3d62daeb3d2) |
| 17 | `expire(bad-1)` | stranger | **ERROR** | `expire(bad-1)` again: **UserError** `the sheet is settled` | [`0x27df030c…ff0d8f`](https://explorer-studio-dev.genlayer.com/tx/0x27df030caf986f44f719962cc0a6dedcfb78a1fc3355598c67c3e803d9ff0d8f) |
| 18 | `withdraw_funder(bad-1)` | stranger | **ERROR** | `withdraw_funder(bad-1)` by a non-funder: **UserError** `only the funder may withdraw` | [`0xbadec073…309585`](https://explorer-studio-dev.genlayer.com/tx/0xbadec073f76fe4c3bcefbbf887f426d026c8ed361b169089bb16a1e221309585) |
| 19 | `withdraw_funder(bad-1)` | funder | SUCCESS | FINALIZED. funder takes the 2 GEN of the void sheet back | [`0x41154cda…98a697`](https://explorer-studio-dev.genlayer.com/tx/0x41154cda8e7b482e4fe5449a57eee3d21c379454b893f5c1695dd6a39398a697) |
| 20 | `withdraw_credit()` | funder | SUCCESS | FINALIZED. funder withdraws the 3.5 GEN credit from the two refused sheets | [`0x9375b79c…5a9c0d`](https://explorer-studio-dev.genlayer.com/tx/0x9375b79c7bd59159840888b28747931c0adcdd673a2065c835b378e6675a9c0d) |
| 21 | `open_sheet(dl-1)` value 1 GEN | funder | SUCCESS | `dl-1`: 1 GEN, 1 round, deadline = unlock + 130 s = 1793366728 (chain time of the call 1793366538) | [`0xae4b0446…1b2400`](https://explorer-studio-dev.genlayer.com/tx/0xae4b044600061b1c5d8c498d7c4f5096e19809481cfe412637122eb9df1b2400) |
| 22 | `expire(dl-1)` | stranger | **ERROR** | `expire(dl-1)` before the deadline: **UserError** `the settlement deadline has not passed; expiry opens at 1793366728` | [`0x0f7f9cb8…7cdc65`](https://explorer-studio-dev.genlayer.com/tx/0x0f7f9cb86a12cf8f2d29b0468de5a538a163db3fc026dd5dedce2f3d4e7cdc65) |
| 23 | `split(dl-1)` | stranger | **ERROR** | `split(dl-1)` after the deadline: **UserError** `the settlement deadline has passed at 1793366728; only expire is accepted` | [`0x2adc9486…147b33`](https://explorer-studio-dev.genlayer.com/tx/0x2adc948621f3f8beaa50dea4f4e53eccc79775bdb8a467bbd5e8224777147b33) |
| 24 | `expire(dl-1)` | stranger | SUCCESS | `expire(dl-1)` at/after the deadline → VOID | [`0x89cdf093…1ecc7b`](https://explorer-studio-dev.genlayer.com/tx/0x89cdf093ece0658e6ad5e8365c56ac09f439cc53209e5953387abef3951ecc7b) |
| 25 | `withdraw_funder(dl-1)` | funder | SUCCESS | FINALIZED. funder takes the escrow back | [`0x1ea1f2e1…8bddec`](https://explorer-studio-dev.genlayer.com/tx/0x1ea1f2e1e8ecab458b1d6e2fc520f2687cf7cc782ff3a24a50574213308bddec) |

### What the run shows

* **A list the validators agreed on, then paid.** `good-1` needed two rounds with the same list hash
  (txs 6 and 9). The payees' wallets afterwards held exactly 2.0, 1.2 and 0.8 GEN (read from chain),
  the pot of 4 GEN to the last wei; the contract balance was 0.
* **An unacceptable page moves nothing.** On the draft page (`bad-1`) validators produced no list;
  the round is stored with `finding: invalid, reason: no_list`.
* **Registry and money guards.** An oversized page and a below-minimum funding were refused in the
  return value with the full amount credited; `withdraw_credit` returned 3.5 GEN.
* **The deadline splits time in two.** Txs 22–23 on `dl-1`: `expire` one step before the deadline and
  `split` after it are both refused, each with its own message; `expire` then works.
* **Evidence kept per round.** `get_round("good-1", 1)` returns the page hash
  `a7979859ee88…`, the list read, its hash `e95a456f51cc…` and the outcome; `get_round("bad-1", 1)` keeps the
  invalid round.

### What this run did not show

* The 90 % draft page produced `no_list` (the model declined to read a list from a draft), not
  `shares_do_not_add_up`. That rule, a made-up address, duplicates, non-integer shares and a forged
  consensus answer are covered by unit tests (`test_an_unacceptable_list_is_invalid_and_moves_nothing`
  and neighbours), not by a model failure on chain: a model cannot be made to fail on demand.
* Tx 15 shows `expire` succeeding on `bad-1` only because its deadline had passed while the claims of
  `good-1` were finalizing; the pre-deadline and post-deadline refusals are demonstrated on `dl-1`
  (txs 22–23) instead.

End state: `list_sheets(0, 10)` → `good-1 final`, `bad-1 void` (and `dl-1 void`, created afterwards);
`get_balance` → `{"balance":"0","credits":"0","held":"0"}`.
