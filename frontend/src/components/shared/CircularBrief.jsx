import { useEffect, useState } from "react";
import { CalendarClock, ListChecks, Loader2, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { circularInsightsApi } from "@/lib/api/modules/circularInsights";
import { notifyError } from "@/lib/api/notice";
import { formatDate } from "@/lib/circulars/context";

/**
 * A circular made easy to act on: what it says in a sentence and in plain
 * words, the points that matter, what has to be done and by when, and whose
 * work it changes - then any question about it, answered from its text.
 *
 * The brief is written once and kept with the circular, so everybody reads
 * the same one. Nothing in it is added to the circular: an instruction that
 * is not in the text does not appear here.
 *
 * `own` is true on the reader's own page: opening the brief there counts as
 * having read the circular, which is tracked apart from acknowledging it.
 */
export default function CircularBrief({ circular, own = false, canRefresh = false }) {
  const [brief, setBrief] = useState(null);
  const [failed, setFailed] = useState("");
  const [busy, setBusy] = useState("");
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    circularInsightsApi.brief(circular.id).then(
      (data) => !cancelled && setBrief(data),
      (error) => !cancelled && setFailed(error?.message || "The brief could not be prepared.")
    );
    if (own) circularInsightsApi.markRead(circular.id);
    return () => {
      cancelled = true;
    };
  }, [circular.id, own]);

  const ask = async (words) => {
    setBusy("asking");
    try {
      const reply = await circularInsightsApi.ask(circular.id, words);
      setAnswers((prev) => [...prev, { question: words || "What does this mean for me?", ...reply }]);
      setQuestion("");
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  const refresh = async () => {
    setBusy("refreshing");
    try {
      setBrief(await circularInsightsApi.brief(circular.id, { refresh: true }));
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  if (failed) return <p className="text-sm text-destructive">{failed}</p>;
  if (!brief) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-primary">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Preparing the brief…
      </p>
    );
  }

  const touches = [...brief.affectedDepartments, ...brief.affectedRoles.filter((role) => !brief.affectedDepartments.includes(role))];

  return (
    <div className="space-y-4 text-sm text-primary">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-2 font-bold">
          <Sparkles className="size-4" aria-hidden="true" />
          AI Brief
        </p>
        {canRefresh && (
          <Button type="button" variant="outline" size="sm" className="ms-auto" onClick={refresh} disabled={Boolean(busy)}>
            {busy === "refreshing" && <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />}
            Write Again
          </Button>
        )}
      </div>
      {brief.notes?.map((note) => (
        <p key={note} className="text-xs text-amber-800">
          {note}
        </p>
      ))}

      <p className="rounded-lg bg-blue-50/60 px-4 py-3 leading-relaxed">{brief.summary}</p>
      {brief.plainLanguage && (
        <p>
          <span className="font-semibold">In plain words: </span>
          {brief.plainLanguage}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {brief.keyPoints.length > 0 && (
          <div>
            <h4 className="font-semibold">Key Points</h4>
            <ul className="mt-1 list-disc space-y-1 ps-5">
              {brief.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h4 className="flex items-center gap-1.5 font-semibold">
            <ListChecks className="size-4" aria-hidden="true" />
            Required Actions
          </h4>
          {brief.actions.length === 0 ? (
            <p className="mt-1 text-muted-foreground">The circular asks for nothing to be done. It is for information.</p>
          ) : (
            <ul className="mt-1 space-y-2">
              {brief.actions.map((one) => (
                <li key={one.action} className="rounded-lg border border-container-border px-3 py-2">
                  <p>{one.action}</p>
                  <p className="mt-0.5 text-xs text-primary/70">
                    {one.who}
                    {one.deadline ? " · by " + formatDate(one.deadline) : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {brief.deadlines.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 font-semibold">
              <CalendarClock className="size-4" aria-hidden="true" />
              Dates & Deadlines
            </h4>
            <ul className="mt-1 space-y-1">
              {brief.deadlines.map((one) => (
                <li key={one.label}>
                  {one.date && <span className="font-semibold">{formatDate(one.date)}: </span>}
                  {one.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {touches.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 font-semibold">
              <Users className="size-4" aria-hidden="true" />
              Most Affected
            </h4>
            <p className="mt-1">{touches.join(" · ")}</p>
          </div>
        )}
      </div>

      {/* Anything the brief did not make clear, asked and answered here. */}
      <div className="space-y-3 rounded-lg border border-container-border p-3">
        {answers.map((one, index) => (
          <div key={index} className="space-y-1">
            <p className="font-semibold">{one.question}</p>
            <p className="leading-relaxed">{one.answer}</p>
            {one.notes?.map((note) => (
              <p key={note} className="text-xs text-amber-800">
                {note}
              </p>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label={"Ask about circular " + circular.circularNo}
            className="min-w-0 flex-1"
            value={question}
            maxLength={500}
            placeholder="Ask anything about this circular"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && question.trim() && !busy) {
                e.preventDefault();
                ask(question.trim());
              }
            }}
            disabled={Boolean(busy)}
          />
          <Button type="button" onClick={() => ask(question.trim())} disabled={!question.trim() || Boolean(busy)}>
            {busy === "asking" && <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" />}
            Ask AI
          </Button>
          <Button type="button" variant="outline" onClick={() => ask("")} disabled={Boolean(busy)}>
            What Does This Mean for Me?
          </Button>
        </div>
      </div>
    </div>
  );
}
