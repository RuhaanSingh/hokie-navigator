import "server-only";
import { KB_SITES, searchOffice, type KbOffice } from "../kb/search";
import type { OfficeReply } from "./types";

/** Shared L0 tool: an office agent searches its own published website snapshot. */
export function kbReply(office: KbOffice, query: string): OfficeReply {
  const results = searchOffice(office, query, 4);
  return { office, summary: `${results.length} passages from ${KB_SITES[office]}`, data: results, ruleIds: [], freshness: `${KB_SITES[office]} snapshot` };
}
