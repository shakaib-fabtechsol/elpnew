import { useEffect, useState } from "react";
import { api } from "../client";

/**
 * What the AI model reads besides the request box (/ai/overview, /ai/search).
 *
 * Both are readings, never records: nothing is saved by either. Where no AI
 * service is connected, or it is not answering, the server says so
 * (`available: false`) and the screen carries on with its own figures and its
 * own word search - so neither call is ever in the way of the page.
 */
export const aiApi = {
  /** A request list's history and policy figures, read: a suggestion, a likelihood, what stands out. */
  async overview({ kind, measure, history, facts }) {
    const json = await api("ai/overview", { method: "POST", body: { kind, measure, history, facts: facts || {} } });
    return json.data;
  },

  /** A question in plain words, as a query in the search box's own syntax. */
  async search(question, fields) {
    const json = await api("ai/search", { method: "POST", body: { question, fields } });
    return json.data;
  },
};

// Readings already fetched this session, by what was asked: coming back to a
// tab does not ask (or pay for) the same reading twice.
const overviews = new Map();

/**
 * The AI's reading of one request list, as { reading, loading }.
 *
 * `reading` is null while it is on its way, or where no AI is answering - in
 * which case the overview shows the figures it works out itself. A list with
 * no requests yet is read as well, from the policy figures alone, so the
 * card covers a first request too. `loading` is true only while a reading has
 * been asked for and has not come back, which is when the card shows its
 * own loader.
 *
 * `history` is the list's own rows as { date, amount, status, type }; `facts`
 * the policy figures the page has already worked out (remaining, limit...).
 */
export function useAiOverview({ kind, measure, history, facts }) {
  const asked = JSON.stringify({ kind, measure, history: history.slice(0, 40), facts: facts || {} });
  const [got, setGot] = useState({ asked: "", reading: null });

  useEffect(() => {
    if (overviews.has(asked)) return undefined;
    let cancelled = false;
    aiApi
      .overview(JSON.parse(asked))
      .then((reading) => {
        const kept = reading?.available ? reading : null;
        overviews.set(asked, kept);
        if (!cancelled) setGot({ asked, reading: kept });
      })
      // A reading that fails is simply not shown: the page's own figures stand.
      .catch(() => {
        overviews.set(asked, null);
        if (!cancelled) setGot({ asked, reading: null });
      });
    return () => {
      cancelled = true;
    };
    // `asked` carries everything the reading depends on.
  }, [asked]);

  const answered = overviews.has(asked) || got.asked === asked;
  return {
    reading: overviews.get(asked) ?? (got.asked === asked ? got.reading : null),
    loading: !answered,
  };
}

/**
 * An overview's own figures with the AI's laid over them where it gave one:
 * the suggested sum, the likelihood, the insights, and a line under each
 * saying what it rests on.
 */
export function withAi(read, ai) {
  if (!ai) return read;
  return {
    ...read,
    recommended: ai.recommended ?? read.recommended,
    probability: ai.probability ?? read.probability,
    insights: ai.insights?.length ? ai.insights : read.insights,
    recommendedNote: ai.recommendedReason || "",
    probabilityNote: ai.probabilityReason || "",
    byAi: true,
  };
}
