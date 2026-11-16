# SplitSheet — Studio Dev (chain 61997) deploy record

| | |
|---|---|
| **Network** | GenLayer Studio Dev / Studio Next — chain `61997` |
| **Contract** | [`0xe345d6BcD44bA3B0b125828F64ebd39A95661c46`](https://explorer-studio-dev.genlayer.com/address/0xe345d6BcD44bA3B0b125828F64ebd39A95661c46) |
| **Deploy tx** | [`0x6a2fc393…032ec1`](https://explorer-studio-dev.genlayer.com/tx/0x6a2fc39375bb6369e6108095e419d1a4d0abbfade6dd86ff9f795196ea032ec1) from `0x9977CB83d7c1f50138541C6FB23DBBF362e27e59`, which has no role in the contract |
| **Source** | [`contracts/SplitSheet.py`](contracts/SplitSheet.py) — runner `py-genlayer:kzybg95x1gn21dw72m7hyg0maaap04n4nx55j9yt6fkdqxtz6bz0` |
| **Source sha256** | `c6969b4837edce901d45a35c9e8c38ea3740902465435bb5f7627312247bf52f` |

## Verify the source yourself

```bash
curl -s -X POST https://studio-dev.genlayer.com/api -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"gen_getContractCode","params":["0xe345d6BcD44bA3B0b125828F64ebd39A95661c46"]}' \
  | python3 -c "import sys,json,base64,hashlib; print(hashlib.sha256(base64.b64decode(json.load(sys.stdin)['result'])).hexdigest())"
shasum -a 256 contracts/SplitSheet.py
# both print c6969b4837edce901d45a35c9e8c38ea3740902465435bb5f7627312247bf52f
```

CI runs the same comparison on every push (`scripts/verify_deployment.py`).

## Runner

On 2026-11-16 Studio Dev moved to GenVM v0.4 and stopped answering reads for contracts on the earlier runner
(`invalid_contract runner malformed`). This is the same contract source, redeployed with the current runner from the
[official runners page](https://sdk.genlayer.com/main/executors/v0.4/python-sdk/available-runners.html):
`py-genlayer:kzybg95x1gn21dw72m7hyg0maaap04n4nx55j9yt6fkdqxtz6bz0` (the `# v0.3.0` header line is unchanged and
accepted). The earlier deployment `0x7D4d47a34f29409617bd08dAc7818eE22fFC349E` is no longer readable.

## Lint

`sh scripts/lint_current_sdk.sh` — `genvm-lint lint` on the file as deployed, then `check` and `typecheck`
on a copy whose header uses the runner bundled with the public linter (`1jb45aa8…`); the linter cannot yet
download the v0.4 runner. The contract body is byte-identical. Passed, in CI.

## The run

Accounts (throwaway test keys): funder `0x1BBc9228c7652e547c220a7B907FE08dab52fef0`, stranger
`0xDc311fEF38e2845d7e00767323EDbC1134772590`, payees Ada `0xDfB9eA20…6d36`, Grace `0x4e34281b…B43d`,
Linus `0xa7DbD986…221A` (listed on the demo page). Sheet pages are files of this repository, read from
`raw.githubusercontent.com`. All of it ran on 2026-11-16 as one script.

| # | Call | Sender | Result | What happened | Tx |
|---|------|--------|--------|---------------|----|
| 1 | `open_sheet(good-1)` value 4 GEN | funder | SUCCESS | `good-1`: 4 GEN, page `release-1-2.md` (50 / 30 / 20 %), 2 agreeing rounds, unlock +90 s, interval 60 s. The page is frozen whole on chain. | [`0x70d68317…5ec8ea`](https://explorer-studio-dev.genlayer.com/tx/0x70d68317c269788a8e1774d235b2da3db5eea3332785dac34af45a76b25ec8ea) |
| 2 | `open_sheet(bad-1)` value 2 GEN | funder | SUCCESS | `bad-1`: 2 GEN, page `bad-sum.md` (a draft, shares add up to 90 %), 1 round, short settlement window (360 s). | [`0xbefcaa4e…6870a5`](https://explorer-studio-dev.genlayer.com/tx/0xbefcaa4e21f57915ea4fcbb050cda358b3e956d12fe4af9890b032e68c6870a5) |
| 3 | `open_sheet(long-1)` value 3 GEN | funder | SUCCESS | `long-1`: 3 GEN, page `long.md` (4 989 characters > 3000) → refused in the return value, 3 GEN credited. | [`0x82fe87b9…cb59af`](https://explorer-studio-dev.genlayer.com/tx/0x82fe87b915284bd910fa825ecc8bcc37d4d2349118374df1ab2434478dcb59af) |
| 4 | `open_sheet(dust-1)` value 0.5 GEN | funder | SUCCESS | `dust-1`: 0.5 GEN → refused (minimum 1 GEN), 0.5 GEN credited. Credit read back: 3.5 GEN. | [`0x910da523…d6b6b5`](https://explorer-studio-dev.genlayer.com/tx/0x910da523cfd4e382be9f84a9ec32f5479c0353068942055a37281c130cd6b6b5) |
| 5 | `split(good-1)` | stranger | **ERROR** | `good-1` before unlock: **UserError** `the sheet unlocks at 1794855260` | [`0x6491f5dd…8455a9`](https://explorer-studio-dev.genlayer.com/tx/0x6491f5dd70771abdbb3b0fb5cafbb7fa9b4ad52cab5c91b72e2aba49d48455a9) |
| 6 | `split(good-1)` | stranger | SUCCESS | `good-1` round 1 (18:54:23 UTC): validators read the table → list proposed (Ada 5000, Grace 3000, Linus 2000 bps), 1 of 2 | [`0x479d67c9…e32a7b`](https://explorer-studio-dev.genlayer.com/tx/0x479d67c90d9477fde1e29d359dcd5cce7609c51bbe74a0729d946b21d2e32a7b) |
| 7 | `split(good-1)` | stranger | **ERROR** | `good-1` again inside the interval: **UserError** `the next round opens at 1794855323` | [`0x36eac501…37ab46`](https://explorer-studio-dev.genlayer.com/tx/0x36eac5012d3485168fc25aec3f3fd6ef1fb811cf26603fa091d74fa3cb37ab46) |
| 8 | `split(bad-1)` | stranger | SUCCESS | `bad-1` round 1 (18:55:02 UTC): finding `invalid` (`shares_do_not_add_up`), nothing proposed, round kept | [`0xe113e16e…e21bf0`](https://explorer-studio-dev.genlayer.com/tx/0xe113e16e7e5996345d076ae2798f7e42bb177903be4de5512be2d45b51e21bf0) |
| 9 | `split(good-1)` | stranger | SUCCESS | `good-1` round 2 (18:55:29 UTC): same list hash `e95a456f…` → **final** | [`0xf1c5af6b…e3a9ed`](https://explorer-studio-dev.genlayer.com/tx/0xf1c5af6b1fbe6b45e583e97b09103359f6460c1092a8d01b5beada6624e3a9ed) |
| 10 | `claim(good-1)` | stranger | SUCCESS | claim Ada: 2 GEN | [`0x7a6afa94…53b989`](https://explorer-studio-dev.genlayer.com/tx/0x7a6afa94cad930d522be22a12612cc1005b85a71c67aa7dd02b8dfb97f53b989) |
| 11 | `claim(good-1)` | stranger | SUCCESS | claim Grace: 1.2 GEN | [`0x77213970…2c4df4`](https://explorer-studio-dev.genlayer.com/tx/0x7721397061e373f066f1a2574aab2326c8a90ba9c76e258c5b9d9ec9312c4df4) |
| 12 | `claim(good-1)` | stranger | SUCCESS | claim Linus: 0.8 GEN | [`0xa3cd6f42…206e1f`](https://explorer-studio-dev.genlayer.com/tx/0xa3cd6f42e63062b62da04aea4d42b30bcaafe517fb144a424b59cdb241206e1f) |
| 13 | `claim(good-1)` | stranger | **ERROR** | claim Ada again: **UserError** `this share was already paid` | [`0x4c46cb0f…a94eba`](https://explorer-studio-dev.genlayer.com/tx/0x4c46cb0fa8a366c8dcf1f11ccb9c7f480112dbe07889201ddf1713a46ea94eba) |
| 14 | `claim(good-1)` | stranger | **ERROR** | claim for an address that is not on the list: **UserError** `that address is not on the final list` | [`0xd1385cff…960a1f`](https://explorer-studio-dev.genlayer.com/tx/0xd1385cff800049fa3dba4ec75b0e478736f7396696ceecc25784e47c39960a1f) |
| 15 | `split(bad-1)` | stranger | **ERROR** | `split(bad-1)` after its deadline: **UserError** `the settlement deadline has passed at 1794855632; only expire is accepted` | [`0xc5190c8e…5f330e`](https://explorer-studio-dev.genlayer.com/tx/0xc5190c8e340a541620a67631ac41d63af504bb3859a12e0078bcd7db045f330e) |
| 16 | `expire(bad-1)` | stranger | SUCCESS | `expire(bad-1)` → VOID | [`0x808e1526…f4887b`](https://explorer-studio-dev.genlayer.com/tx/0x808e1526bf7dba99d1a1b71b6f8c8895ed1598e894f6516a45f91e4d3cf4887b) |
| 17 | `expire(bad-1)` | stranger | **ERROR** | `expire(bad-1)` again: **UserError** `the sheet is settled` | [`0x560a02bb…e548f8`](https://explorer-studio-dev.genlayer.com/tx/0x560a02bbd245fae0800c892ad4613f176698e6df9c4283c007c0071f31e548f8) |
| 18 | `withdraw_funder(bad-1)` | stranger | **ERROR** | `withdraw_funder(bad-1)` by a non-funder: **UserError** `only the funder may withdraw` | [`0xdaf3d957…22ceb9`](https://explorer-studio-dev.genlayer.com/tx/0xdaf3d95737914f9c3b079d9b86ef239611a165e503ef6ba895c474583122ceb9) |
| 19 | `withdraw_funder(bad-1)` | funder | SUCCESS | funder takes the 2 GEN of the void sheet back | [`0xa59cdb97…0c5f93`](https://explorer-studio-dev.genlayer.com/tx/0xa59cdb971387a3b23ba463c801aa8c214311c3e470b4f7b1553e3655810c5f93) |
| 20 | `withdraw_credit()` | funder | SUCCESS | funder withdraws the 3.5 GEN credit from the two refused sheets | [`0x8020e42e…f6e1e2`](https://explorer-studio-dev.genlayer.com/tx/0x8020e42e489b28d02e47e46d4b6fa8d1a1d82051352aea86704071f649f6e1e2) |
| 21 | `open_sheet(dl-1)` value 1 GEN | funder | SUCCESS | `dl-1`: 1 GEN, 1 round, deadline 1794855957 | [`0x6dbfe2c9…7051a1`](https://explorer-studio-dev.genlayer.com/tx/0x6dbfe2c92642e9c77c1c48eddadd87b43b841db348658f0fd40c69aa0f7051a1) |
| 22 | `expire(dl-1)` | stranger | **ERROR** | `expire(dl-1)` before the deadline: **UserError** `the settlement deadline has not passed; expiry opens at 1794855957` | [`0x417672f1…e48054`](https://explorer-studio-dev.genlayer.com/tx/0x417672f123fabac48fc2ad05a80db150db8c70fe62df128da67f8637a4e48054) |
| 23 | `split(dl-1)` | stranger | **ERROR** | `split(dl-1)` after the deadline: **UserError** `the settlement deadline has passed at 1794855957; only expire is accepted` | [`0xc0be3b90…0ed1f6`](https://explorer-studio-dev.genlayer.com/tx/0xc0be3b905c8eef363f0bd2f5a0c1e1b2630378c54eff86360ce3dfc3b20ed1f6) |
| 24 | `expire(dl-1)` | stranger | SUCCESS | `expire(dl-1)` at/after the deadline → VOID | [`0x0797cf8b…7ad84d`](https://explorer-studio-dev.genlayer.com/tx/0x0797cf8b1af020461f0f8d8df18ce6acd2f37164f4a822d91831471b447ad84d) |
| 25 | `withdraw_funder(dl-1)` | funder | SUCCESS | funder takes the escrow back | [`0x35ba9ceb…a3b7bb`](https://explorer-studio-dev.genlayer.com/tx/0x35ba9ceb05d25f40092ed7d7eddf379e56b332b697ddca3702b57b7ad9a3b7bb) |

### What the run shows

* **A list the validators agreed on, then paid.** `good-1` needed two rounds with the same list hash
  (txs 6 and 9); the three claims paid 2, 1.2 and 0.8 GEN, the pot of 4 GEN to the last wei; the contract
  balance ended at 0.
* **An unacceptable page moves nothing.** On the draft page (`bad-1`) validators found the shares do not add
  up (`finding: invalid`, `reason: shares_do_not_add_up`); the round is stored and nothing is proposed.
* **Registry and money guards.** An oversized page and a below-minimum funding were refused in the return
  value with the full amount credited; `withdraw_credit` returned 3.5 GEN.
* **The deadline splits time in two.** Txs 15–16 on `bad-1` and 22–24 on `dl-1`: `split` after the deadline and
  `expire` before it are each refused with their own message; `expire` then works.
* **Evidence kept per round.** `get_round("good-1", 1)` returns the page hash `a7979859ee88…`, the list read,
  its hash `e95a456f51cc…` and the outcome; `get_round("bad-1", 1)` keeps the invalid round.

### What this run did not show

* A made-up address, duplicates, non-integer shares and a forged consensus answer are covered by unit tests
  (`test_an_unacceptable_list_is_invalid_and_moves_nothing` and neighbours), not by a model failure on chain:
  a model cannot be made to fail on demand.
* Every round was recorded on the first try, so the "disagreement records nothing, send it again" path was
  not exercised on chain; it is covered by unit tests.

End state: `list_sheets(0, 10)` → `good-1 final`, `bad-1 void`, `dl-1 void`;
`get_balance` → `{"balance":"0","credits":"0","held":"0"}`.
