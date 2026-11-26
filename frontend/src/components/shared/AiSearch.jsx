import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Loader } from "./Loader";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { aiApi } from "@/lib/api/modules/ai";
import { fieldsSeenFor } from "@/lib/search/smartSearch";

// Questions already read this session, so asking one again costs nothing.
const understood = new Map();

/** A question rather than a key word or two: worth asking the AI about. */
const isQuestion = (text) => text.trim().split(/\s+/).length >= 3 && !/[:<>]/.test(text);

/**
 * The one search box in the system - SADEED's approved search layout, used on
 * every page. Later reference images may draw it differently; they are not to
 * be followed.
 *
 * Every list is searched the same way and in the same place - the start of
 * the row above the table - so finding something is never a matter of working
 * out how this particular page does it: a magnifying glass, the words, and a
 * Ctrl + K hint, since Ctrl + K (Cmd + K on a Mac) puts the cursor here from
 * anywhere on the page. The query is still read for meaning, not matched
 * literally: see `smartSearch`.
 *
 * A word or two is searched as it is typed. A question in plain words - three
 * words or more - is also sent, once the typing pauses, to the AI service,
 * which answers with a query the list can run ("department:judicial
 * salary>1500"); that query replaces the words for the search, while the box
 * goes on showing what was typed. The AI is told the question and the list's
 * column names, never its rows - and where no AI is answering, the word
 * search already on screen simply stands.
 */
export default function AiSearch({
  value,
  onChange,
  placeholder = "Ask anything...",
  className,
}) {
  // What is in the box. The page holds the query the list is searched with,
  // which is the same thing until a question has been read.
  const [text, setText] = useState(value || "");
  const [sent, setSent] = useState(value || "");
  const [reading, setReading] = useState(false);
  const [meaning, setMeaning] = useState("");
  const latest = useRef(text);
  const input = useRef(null);

  // Ctrl + K / Cmd + K: into the search. Where a page has more than one list,
  // the first on the page is the one the shortcut means.
  useEffect(() => {
    const onKey = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      if (document.querySelector("[data-list-search]") !== input.current) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  // Cleared or set from outside (a filter reset, a page change): follow it.
  if (value !== sent) {
    setSent(value || "");
    setText(value || "");
    setMeaning("");
  }

  const send = (query) => {
    setSent(query);
    onChange(query);
  };

  const type = (next) => {
    latest.current = next;
    setText(next);
    setMeaning("");
    send(next);
  };

  useEffect(() => {
    const question = text.trim();
    if (!isQuestion(question)) return undefined;

    const apply = (read) => {
      // Only if the box still holds the question that was asked.
      if (latest.current.trim() !== question || !read?.query) return;
      setMeaning(read.explanation || read.query);
      send(read.query);
    };

    if (understood.has(question)) {
      apply(understood.get(question));
      return undefined;
    }

    // Once the typing pauses, not on every letter.
    const timer = setTimeout(() => {
      setReading(true);
      aiApi
        .search(question, fieldsSeenFor(question))
        .then((read) => {
          const kept = read?.available && read.query ? read : null;
          understood.set(question, kept);
          apply(kept);
        })
        // No AI answering: the word search already on screen stands.
        .catch(() => {})
        .finally(() => setReading(false));
    }, 900);
    return () => clearTimeout(timer);
    // The question is all this depends on; `send` is the page's own setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className={cn("relative w-full sm:w-96 lg:w-[30rem]", className)}>
      {reading ? (
        <Loader size={16} label="Reading your question" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2" />
      ) : (
        <Search className="pointer-events-none absolute start-3 top-1/2 size-[18px] -translate-y-1/2 text-primary" strokeWidth={1.75} />
      )}
      <Input
        ref={input}
        data-list-search=""
        type="search"
        aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
        value={text}
        onChange={(e) => type(e.target.value)}
        placeholder={placeholder}
        title={meaning ? "Understood as: " + meaning : undefined}
        className={cn("h-[42px] ps-10", meaning ? "pe-12" : "pe-20")}
      />
      {/* The shortcut, said where it applies. Gone once something is typed,
          where the box's own clear button takes the space. */}
      {!text && (
        <kbd className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-container-border bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted-foreground sm:inline-block">
          {isMac ? "\u2318 K" : "Ctrl + K"}
        </kbd>
      )}
      {/* That the question was read, and - on hover - how. */}
      {meaning && (
        <span
          title={"Understood as: " + meaning}
          className="absolute end-9 top-1/2 -translate-y-1/2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
        >
          AI
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {meaning ? "Understood as: " + meaning : ""}
      </span>
    </div>
  );
}
