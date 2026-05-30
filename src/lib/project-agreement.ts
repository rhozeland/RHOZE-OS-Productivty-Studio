/**
 * Standard Rhozeland project agreement template.
 *
 * The terms in this file are the off-chain document that gets shown to both
 * parties on a project proposal. They can be lightly customized per-proposal
 * (the user edits the `terms_text` field) but always default to this
 * template so every signed proposal carries the same baseline protections.
 *
 * The full document is hashed (SHA-256) server-side together with the
 * title / summary / budget / milestones snapshot at the moment of signing.
 * That hash becomes the canonical agreement fingerprint and gets anchored
 * on Solana via the `anchor-proposal-signature` edge fn.
 */
export const TERMS_VERSION = "rhozeland-agreement-v1-2026";

export interface AgreementContext {
  clientName: string;
  creatorName: string;
  title: string;
  summary?: string | null;
  totalBudget: number;
  currency: string;
  milestones: Array<{ title: string; credit_amount: number }>;
}

const fmtMoney = (n: number, currency: string) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase() === "USD" ? "USD" : "USD",
    maximumFractionDigits: 0,
  });

export const buildDefaultAgreement = (ctx: AgreementContext): string => {
  const milestoneLines = ctx.milestones.length
    ? ctx.milestones
        .map((m, i) => `   ${i + 1}. ${m.title} — ${fmtMoney(Number(m.credit_amount ?? 0), ctx.currency)}`)
        .join("\n")
    : "   (No milestones defined — full budget paid on completion.)";

  return [
    `RHOZELAND PROJECT SERVICE AGREEMENT`,
    `Version: ${TERMS_VERSION}`,
    ``,
    `PARTIES`,
    `   Client:  ${ctx.clientName}`,
    `   Creator: ${ctx.creatorName}`,
    ``,
    `1. SCOPE OF WORK`,
    `   Project: "${ctx.title}"`,
    `   ${ctx.summary?.trim() || "(See attached brief.)"}`,
    ``,
    `   Milestones:`,
    milestoneLines,
    ``,
    `2. COMPENSATION`,
    `   Total budget: ${fmtMoney(ctx.totalBudget, ctx.currency)}.`,
    `   Funds are released milestone-by-milestone upon Client approval.`,
    `   Rhozeland's platform fee (7–15% based on Creator tier) is deducted`,
    `   at payout. Creator is responsible for their own taxes.`,
    ``,
    `3. TIMELINE & REVISIONS`,
    `   Creator will deliver each milestone in good faith on the agreed dates.`,
    `   Each milestone includes up to two (2) rounds of revisions. Additional`,
    `   rounds require a new milestone or written agreement on extra cost.`,
    ``,
    `4. INTELLECTUAL PROPERTY`,
    `   Upon final payment, all deliverables transfer to the Client.`,
    `   Creator retains the right to display the work in their portfolio`,
    `   and on Rhozeland unless explicitly NDA-restricted in writing.`,
    `   Creator warrants that all delivered work is original or properly`,
    `   licensed and does not infringe any third-party rights.`,
    ``,
    `5. CONFIDENTIALITY`,
    `   Both parties agree to keep non-public project information confidential`,
    `   for twelve (12) months following completion or termination.`,
    ``,
    `6. CANCELLATION & TERMINATION`,
    `   Either party may terminate with written notice. Client owes Creator`,
    `   for work completed and milestones approved up to the termination date.`,
    `   Any escrowed funds for unapproved milestones are refunded to Client.`,
    ``,
    `7. DISPUTE RESOLUTION`,
    `   Disputes are first routed to Rhozeland Concierge for non-binding`,
    `   mediation. If unresolved within fourteen (14) days, either party`,
    `   may pursue independent binding arbitration in their local jurisdiction.`,
    ``,
    `8. ON-CHAIN PROOF`,
    `   This agreement — together with the title, summary, budget, currency,`,
    `   and milestone list — is hashed (SHA-256) at the moment of signing.`,
    `   The hash is posted to the Solana blockchain as immutable proof that`,
    `   both parties agreed to these exact terms. Any subsequent edit voids`,
    `   the on-chain signature and requires re-signing.`,
    ``,
    `By signing, both parties accept these terms in full.`,
  ].join("\n");
};
