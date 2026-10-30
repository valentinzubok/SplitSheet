import { describe, expect, it } from "vitest";
import { claimOutcome, creditOutcome, openOutcome, refundOutcome, roundOutcome } from "./outcome";

const ME = "0xAbC0000000000000000000000000000000000001";
const GEN = BigInt(10) ** BigInt(18);

describe("open_sheet", () => {
  it("reports success only when the sheet exists and is ours", () => {
    const o = openOutcome({ funder: ME.toLowerCase(), funding: (BigInt(4) * GEN).toString() }, ME, BigInt(0), BigInt(0), BigInt(4) * GEN);
    expect(o.verdict).toBe("done");
    expect(o.detail).toContain("4 GEN");
  });
  it("an accepted but refused sheet is reported as refused, with the credit", () => {
    const o = openOutcome(null, ME, BigInt(0), BigInt(4) * GEN, BigInt(4) * GEN);
    expect(o.verdict).toBe("refused");
    expect(o.title).toContain("NOT opened");
    expect(o.credit).toBe((BigInt(4) * GEN).toString());
  });
  it("an id taken by someone else is not a success", () => {
    const o = openOutcome({ funder: "0x0000000000000000000000000000000000000002", funding: "1" }, ME, BigInt(0), BigInt(0), GEN);
    expect(o.verdict).toBe("refused");
    expect(o.detail).toContain("another account");
  });
  it("before finalization nothing is claimed", () => {
    expect(openOutcome(null, ME, BigInt(0), BigInt(0), GEN).verdict).toBe("pending");
  });
  it("a credit that was already there is not mistaken for a new refusal", () => {
    expect(openOutcome(null, ME, GEN, GEN, GEN).verdict).toBe("pending");
  });
});

describe("split rounds", () => {
  const r = (outcome: string, finding = "list", reason = "") => ({ finding, outcome, reason, round: 2 });
  it("a final round says the list is agreed", () => {
    expect(roundOutcome(1, r("final")).title).toBe("List agreed");
  });
  it("proposed and confirmed rounds count but are not final", () => {
    expect(roundOutcome(1, r("proposed")).verdict).toBe("done");
    expect(roundOutcome(1, r("confirmed")).detail).toContain("more agreeing rounds");
  });
  it("a different list restarts the count", () => {
    expect(roundOutcome(1, r("restarted")).title).toContain("restarted");
  });
  it("an invalid list is reported as a round that moved nothing, with the reason", () => {
    const o = roundOutcome(1, r("no_progress", "invalid", "shares_do_not_add_up"));
    expect(o.verdict).toBe("refused");
    expect(o.detail).toContain("shares_do_not_add_up");
  });
  it("no new round yet is pending", () => {
    expect(roundOutcome(2, r("final")).verdict).toBe("pending");
    expect(roundOutcome(0, null).verdict).toBe("pending");
  });
});

describe("claims and refunds", () => {
  it("a share counts as paid only when the chain marks it", () => {
    expect(claimOutcome({ address: ME, claimed: true }).verdict).toBe("done");
    expect(claimOutcome({ address: ME, claimed: false }).verdict).toBe("pending");
    expect(claimOutcome(undefined).verdict).toBe("pending");
  });
  it("a refund counts only when the sheet is marked refunded", () => {
    expect(refundOutcome(true).verdict).toBe("done");
    expect(refundOutcome(false).verdict).toBe("pending");
  });
});

describe("withdraw_credit", () => {
  it("reports success only when the credit went to zero", () => {
    expect(creditOutcome(GEN, BigInt(0)).verdict).toBe("done");
  });
  it("a credit that is still there is not success", () => {
    expect(creditOutcome(GEN, GEN).verdict).toBe("pending");
  });
  it("nothing to withdraw is not success", () => {
    expect(creditOutcome(BigInt(0), BigInt(0)).verdict).toBe("pending");
  });
});
