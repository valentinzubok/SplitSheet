/**
 * A transaction can be accepted by consensus and still not do what the user asked: the
 * contract refuses a sheet in its return value and books the money as a credit (a refused
 * payable call must not revert, or the value would be lost). The console therefore never
 * reports success from the receipt alone. It reads the chain after the call and decides with
 * these functions, which are pure so they can be tested.
 */

export type Verdict = "done" | "refused" | "pending";

export type Outcome = {
  verdict: Verdict;
  title: string;
  detail: string;
  /** Wei the user can take back with withdraw_credit, when the call was refused. */
  credit?: string;
};

const ONE = BigInt(10) ** BigInt(18);
const fmt = (wei: bigint) => {
  const whole = wei / ONE;
  const frac = (wei % ONE).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.slice(0, 6)}` : `${whole}`;
};

export type SheetSeen = { funder: string; funding: string } | null;

/** After open_sheet: did a sheet with this id appear, written by this account? */
export function openOutcome(
  sheet: SheetSeen,
  me: string,
  creditBefore: bigint,
  creditAfter: bigint,
  sent: bigint,
): Outcome {
  if (sheet && sheet.funder.toLowerCase() === me.toLowerCase()) {
    return {
      verdict: "done",
      title: "Sheet opened",
      detail: `${fmt(BigInt(sheet.funding))} GEN is escrowed and the page is frozen on chain.`,
    };
  }
  if (creditAfter - creditBefore >= sent && sent > BigInt(0)) {
    return {
      verdict: "refused",
      title: "The sheet was NOT opened",
      detail: `The contract refused it and kept your ${fmt(sent)} GEN as a credit. Take it back with "take it back".`,
      credit: (creditAfter - creditBefore).toString(),
    };
  }
  if (sheet) {
    return {
      verdict: "refused",
      title: "The sheet was NOT opened",
      detail: "A sheet with this id already belongs to another account.",
    };
  }
  return {
    verdict: "pending",
    title: "Waiting for the chain",
    detail: "The transaction is accepted but neither the sheet nor a credit is visible yet. Refresh after finalization.",
  };
}

export type RoundSeen = { finding: string; outcome: string; reason: string; round: number } | null;

/** After split: say what the round did. A round that moved nothing is not a failure of the call. */
export function roundOutcome(roundsBefore: number, round: RoundSeen): Outcome {
  if (!round || round.round <= roundsBefore) {
    return { verdict: "pending", title: "Waiting for the chain", detail: "The round is not visible yet. Refresh after finalization." };
  }
  if (round.outcome === "final") {
    return { verdict: "done", title: "List agreed", detail: "Enough separated rounds agreed on the same list. Every payee can now be paid." };
  }
  if (round.outcome === "proposed" || round.outcome === "confirmed") {
    return { verdict: "done", title: "Round counted", detail: "Validators read a valid list; more agreeing rounds are still needed." };
  }
  if (round.outcome === "restarted") {
    return { verdict: "done", title: "Round counted, count restarted", detail: "Validators read a different valid list, so the count starts again from one." };
  }
  return {
    verdict: "refused",
    title: "The round moved nothing",
    detail: `Validators did not produce an acceptable list (${round.finding}${round.reason ? `: ${round.reason}` : ""}). The round is kept as evidence.`,
  };
}

export type ShareSeen = { address: string; claimed: boolean } | undefined;

/** After claim: is that payee's share marked paid? */
export function claimOutcome(share: ShareSeen): Outcome {
  if (share?.claimed) {
    return { verdict: "done", title: "Share paid", detail: "The share is on its way to the payee; it lands when the transaction is finalized." };
  }
  return { verdict: "pending", title: "Waiting for the chain", detail: "The share is not marked paid yet. Refresh after finalization." };
}

/** After withdraw_funder: is the sheet marked refunded? */
export function refundOutcome(refunded: boolean): Outcome {
  return refunded
    ? { verdict: "done", title: "Escrow returned", detail: "The funding is on its way back to the funder; it lands when the transaction is finalized." }
    : { verdict: "pending", title: "Waiting for the chain", detail: "The refund is not marked yet. Refresh after finalization." };
}

/** After withdraw_credit: did the credit go to zero? */
export function creditOutcome(creditBefore: bigint, creditAfter: bigint): Outcome {
  if (creditBefore > BigInt(0) && creditAfter === BigInt(0)) {
    return {
      verdict: "done",
      title: "Credit withdrawn",
      detail: `${fmt(creditBefore)} GEN is on its way to your wallet; it lands when the transaction is finalized.`,
    };
  }
  return { verdict: "pending", title: "Waiting for the chain", detail: "The credit is still shown. Refresh after finalization." };
}
