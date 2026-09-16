import { SAMPLE_CHAT, SAMPLE_LEASE, SAMPLE_OFFER_LETTER } from "./sample";

/**
 * The three demo scenarios. These are EXAMPLES of the generic case system —
 * there is no domain-specific logic anywhere; each demo only pre-fills the
 * problem text and offers example answers and a sample document to attach.
 */

export type Demo = {
  id: string;
  /** Home-page chip label. */
  chip: string;
  problem: string;
  /** Example answers, filled by question position — for a fast demo only. */
  answers: string[];
  /** A document the user can attach in one click to complete the demo. */
  sample: { label: string; name: string; text: string };
};

export const DEMOS: Demo[] = [
  {
    id: "deposit",
    chip: "Security deposit",
    problem:
      "My landlord hasn't returned my security deposit. I moved out over a month ago and he only says there were 'damages', without giving any details or an itemized list.",
    answers: [
      "I moved out on 12 August 2026. We had agreed verbally in June to end the tenancy early.",
      "He only said there were 'damages to the flat' — no details, nothing in writing.",
      "No, I never received an itemized list of deductions.",
      "Yes, a written lease with a ₹50,000 deposit, and I have the payment receipt.",
      "The flat is in Pune, Maharashtra.",
      "I want the deposit back or at least a proper explanation of any deductions.",
    ],
    sample: { label: "Sample rental agreement", name: "Rental agreement.pdf", text: SAMPLE_LEASE },
  },
  {
    id: "salary",
    chip: "Unpaid salary",
    problem:
      "My employer hasn't paid my salary. I have received nothing for the last two months even after asking repeatedly — they only say there are cash-flow issues.",
    answers: [
      "My fixed monthly salary is ₹60,000. Nothing has been paid for July or August 2026.",
      "I asked in person twice and by email once in August. They replied that payments are delayed due to cash-flow issues.",
      "I have the signed employment agreement and my bank statements showing no credits.",
      "I am still employed there and continuing to work.",
      "The company is in Pune, Maharashtra.",
      "I want the two months of unpaid salary, and to understand my options if they keep delaying.",
    ],
    sample: {
      label: "Sample employment agreement",
      name: "Employment agreement.docx",
      text: SAMPLE_OFFER_LETTER,
    },
  },
  {
    id: "refund",
    chip: "Refund dispute",
    problem:
      "A seller won't refund my defective product. The mixer grinder I bought online stopped working within a week; they accepted the fault in chat but refuse anything except repair.",
    answers: [
      "I bought a mixer grinder for ₹4,500 online on 5 September 2026. It stopped working on 7 September.",
      "They confirmed the fault from a video I sent, but said refund is 'not possible as per store policy' — repair only.",
      "I have the invoice, the UPI payment record, and the full WhatsApp conversation with their support team.",
      "They stopped replying after 10 September.",
      "The seller operates online; I am in Jaipur, Rajasthan.",
      "I want a refund of the ₹4,500 since the product was defective within days.",
    ],
    sample: {
      label: "Sample purchase record and chat",
      name: "Purchase record and chat.txt",
      text: SAMPLE_CHAT,
    },
  },
];

export function demoById(id: string | null | undefined): Demo | undefined {
  return DEMOS.find((d) => d.id === id);
}
