import type { RedactionResult, RedactionSummary } from './types';

const MYKAD_PATTERN = /\b\d{6}-\d{2}-\d{4}\b/g;
const PASSPORT_PATTERN = /\b(?:Passport(?:\s*(?:No\.?|Number|#))?\s*:?\s*)([A-Z]{1,2}\d{7,8})\b/gi;
const GENERIC_MY_PASSPORT_PATTERN = /\b[AHK]\d{7,8}\b/g;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_PATTERN = /(?:\+?6?01[0-9][-\s]?\d{3,4}[-\s]?\d{4}|\+\d{1,3}[-\s]?\d{1,4}[-\s]?\d{3,4}[-\s]?\d{3,4}|(?:\b0[3-9])[-\s]?\d{7,8}\b)/g;
const BANK_CONTEXT_PATTERN = /\b((?:(?:Maybank|CIMB|Public Bank|RHB|Hong Leong|AmBank|UOB|OCBC|HSBC|Bank)\s+)?(?:Account|Acct|A\/C|Maybank|CIMB|Public Bank|RHB|Hong Leong|AmBank|UOB|OCBC|HSBC|Bank)\s*(?:No\.?|Number|#)?\s*:?\s*)(\d[\d\s-]{8,18}\d)\b/gi;
const CARD_PATTERN = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const SSM_REG_PATTERN = /\b(?:\d{6}-[A-Z]|20\d{10})\b/g;
const ADDRESS_PATTERN = /\b(?:Unit|No\.?|Lot|Suite|Apt|Apartment|Block|Blk)\s+[A-Za-z0-9\-\/]+,\s*(?:[A-Z][A-Za-z0-9\s\-]{2,40},\s*){1,3}(?:Kuala Lumpur|Selangor|Penang|Johor Bahru|Putrajaya|Cyberjaya|Petaling Jaya|Subang Jaya|Shah Alam|Singapore|Malaysia|\d{5})\b/gi;

export function redactPII(input: string): RedactionResult {
  const breakdown: RedactionSummary = {
    mykad: 0,
    passport: 0,
    phone: 0,
    email: 0,
    bankAccount: 0,
    card: 0,
    regId: 0,
    address: 0,
  };

  let text = input;

  text = text.replace(MYKAD_PATTERN, () => {
    breakdown.mykad += 1;
    return '[REDACTED_MYKAD_IC]';
  });

  text = text.replace(EMAIL_PATTERN, () => {
    breakdown.email += 1;
    return '[REDACTED_EMAIL]';
  });

  text = text.replace(CARD_PATTERN, () => {
    breakdown.card += 1;
    return '[REDACTED_CARD]';
  });

  text = text.replace(BANK_CONTEXT_PATTERN, (_match, prefix: string) => {
    breakdown.bankAccount += 1;
    return `${prefix}[REDACTED_BANK_ACCT]`;
  });

  text = text.replace(PASSPORT_PATTERN, (full) => {
    breakdown.passport += 1;
    return full.replace(/[A-Z]{1,2}\d{7,8}/i, '[REDACTED_PASSPORT]');
  });

  text = text.replace(GENERIC_MY_PASSPORT_PATTERN, () => {
    breakdown.passport += 1;
    return '[REDACTED_PASSPORT]';
  });

  text = text.replace(SSM_REG_PATTERN, () => {
    breakdown.regId += 1;
    return '[REDACTED_REG_ID]';
  });

  text = text.replace(ADDRESS_PATTERN, () => {
    breakdown.address += 1;
    return '[REDACTED_ADDRESS]';
  });

  text = text.replace(PHONE_PATTERN, () => {
    breakdown.phone += 1;
    return '[REDACTED_PHONE]';
  });

  const piiItemsRemoved =
    breakdown.mykad +
    breakdown.passport +
    breakdown.phone +
    breakdown.email +
    breakdown.bankAccount +
    breakdown.card +
    breakdown.regId +
    breakdown.address;

  return {
    redactedText: text,
    piiItemsRemoved,
    breakdown,
  };
}
