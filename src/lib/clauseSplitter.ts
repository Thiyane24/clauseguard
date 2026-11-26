import { redactPII } from './piiRedactor';
import type { ParsedClause } from './types';

const HEADING_REGEX = /^(?:(?:CLAUSE|SECTION|ARTICLE)\s+)?(\d+(?:\.\d+)*|[IVXLCDM]+)[.):\-\s]+([A-Z0-9][^\n]{2,110})$/i;
const NUMBERED_LINE_START = /^(?:(?:CLAUSE|SECTION|ARTICLE)\s+)?(\d+(?:\.\d+)*)[.):\s]+/i;

function extractClauseTitle(block: string, fallbackIndex: number): { num: string; title: string } {
  const firstLine = block.split('\n')[0]?.trim() ?? '';
  const headingMatch = firstLine.match(HEADING_REGEX);
  if (headingMatch) {
    const num = headingMatch[1];
    let title = headingMatch[2].trim();
    const colonIdx = title.indexOf(':');
    if (colonIdx > 2 && colonIdx < 64) {
      title = title.slice(0, colonIdx).trim();
    } else if (title.length > 68) {
      title = `${title.slice(0, 65).trim()}...`;
    }
    return { num, title };
  }

  const lineStartMatch = firstLine.match(NUMBERED_LINE_START);
  if (lineStartMatch) {
    const rest = firstLine.slice(lineStartMatch[0].length).trim();
    const colonIdx = rest.indexOf(':');
    const title =
      colonIdx > 2 && colonIdx < 64
        ? rest.slice(0, colonIdx).trim()
        : rest.slice(0, 60).trim() || `Clause ${lineStartMatch[1]}`;
    return { num: lineStartMatch[1], title };
  }

  return { num: String(fallbackIndex), title: `Section ${fallbackIndex}` };
}

export function splitContractIntoClauses(rawContract: string): ParsedClause[] {
  const normalized = rawContract
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const startsNewSection =
      NUMBERED_LINE_START.test(trimmed) &&
      // Avoid splitting sub-bullet lines inside a short sentence if current is tiny
      (current.length === 0 || current.join(' ').trim().length > 45);

    if (startsNewSection && current.length > 0) {
      blocks.push(current.join('\n').trim());
      current = [trimmed];
    } else if (trimmed.length > 0) {
      current.push(trimmed);
    } else if (current.length > 0) {
      // Blank line inside or between paragraphs
      const joined = current.join('\n').trim();
      if (!NUMBERED_LINE_START.test(joined) && joined.length > 260) {
        blocks.push(joined);
        current = [];
      }
    }
  }

  if (current.length > 0) {
    blocks.push(current.join('\n').trim());
  }

  // Filter out pure short title headers if there are numbered clauses following
  const meaningfulBlocks = blocks.filter((b, idx) => {
    if (blocks.length <= 1) return true;
    const isNumbered = NUMBERED_LINE_START.test(b);
    if (idx === 0 && !isNumbered && b.length < 180) {
      // Check if it looks like a contract preamble/party block with PII - keep it if it has substantive text or PII
      return b.length > 60;
    }
    return b.length > 20;
  });

  return meaningfulBlocks.map((rawBlock, index) => {
    const { num, title } = extractClauseTitle(rawBlock, index + 1);
    const redaction = redactPII(rawBlock);
    return {
      clauseId: `clause-${index + 1}`,
      clauseNumber: num,
      rawTitle: title,
      rawText: rawBlock,
      redactedText: redaction.redactedText,
      piiItemsRemoved: redaction.piiItemsRemoved,
      redactionBreakdown: redaction.breakdown,
    };
  });
}
