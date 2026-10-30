/** Live SplitSheet deploy on GenLayer Studio Dev (chain 61997). Override via env. */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_SPLITSHEET_ADDRESS ||
  "0x7D4d47a34f29409617bd08dAc7818eE22fFC349E") as `0x${string}`;

/** Studio Dev / Studio Next — chain ID 61997. */
export const CHAIN_ID = 61997;
export const RPC_URL =
  process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio-dev.genlayer.com/api";
export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_GENLAYER_EXPLORER || "https://explorer-studio-dev.genlayer.com";
export const EXPLORER = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`;
export const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;

export const GITHUB = "https://github.com/valentinzubok/SplitSheet";

/** Demo sheet pages: files in this repository, served by raw.githubusercontent.com. */
const RAW = "https://raw.githubusercontent.com/valentinzubok/SplitSheet/main/web/public/fixtures/sheets";
export const DEMO_SHEET = RAW + "/release-1-2.md";
export const DEMO_INSTRUCTIONS =
  "The table lists each contributor with a wallet address and a percentage share of the pot.";
