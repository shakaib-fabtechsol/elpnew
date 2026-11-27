import { useState } from "react";
import { Check, ChevronDown, FileText, Pencil, Sparkles, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader } from "@/components/shared/Loader";
import { aiApi } from "@/lib/api/modules/ai";
import { attempt } from "@/lib/api/notice";
import { cn } from "@/lib/utils";

/**
 * The parts of Personal Information the redesign added: the languages a
 * person speaks, and their CV as one professional paragraph.
 */

/** The languages offered first; anything else can be typed. */
export const LANGUAGES = ["Arabic", "English", "French", "Hindi", "Urdu", "Swahili", "Persian", "German", "Spanish", "Chinese"];

/** The levels offered for Highest Education Level, lowest first (as the API checks). */
export const EDUCATION_LEVELS = ["Secondary School", "Diploma", "Bachelor's Degree", "Master's Degree", "Doctorate (PhD)", "Other"];

/** Several languages, each a chip that can be taken off. */
export function LanguagesField({ id = "languages", value = [], onChange, required }) {
  const [typed, setTyped] = useState("");
  const toggle = (language) =>
    onChange(value.includes(language) ? value.filter((one) => one !== language) : [...value, language]);
  const addTyped = () => {
    const language = typed.trim();
    if (language && !value.some((one) => one.toLowerCase() === language.toLowerCase())) {
      onChange([...value, language]);
    }
    setTyped("");
  };
  return (
    <div className="form-field space-y-2">
      <Label htmlFor={id}>
        Languages
        {required && <span aria-hidden="true" className="ms-1 text-destructive">*</span>}
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            id={id}
            type="button"
            className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-field border border-input bg-background px-2.5 py-1.5 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {value.length === 0 && <span className="text-muted-foreground">Select languages</span>}
            {value.map((language) => (
              <span key={language} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-sm text-primary">
                {language}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={"Remove " + language}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(language);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      toggle(language);
                    }
                  }}
                  className="rounded hover:text-red-600"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </span>
              </span>
            ))}
            <ChevronDown className="ms-auto size-4 text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {[...new Set([...LANGUAGES, ...value])].map((language) => (
            <DropdownMenuCheckboxItem
              key={language}
              checked={value.includes(language)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => toggle(language)}
            >
              {language}
            </DropdownMenuCheckboxItem>
          ))}
          <div className="border-t p-2" onKeyDown={(event) => event.stopPropagation()}>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTyped();
                }
              }}
              placeholder="Another language - press Enter"
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** One of the two ways to the paragraph, as a radio card. */
function Way({ on, onClick, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm font-semibold text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "border-blue-200 bg-blue-50" : "border-container-border bg-card hover:bg-slate-50"
      )}
    >
      <span aria-hidden="true" className={cn("flex size-5 items-center justify-center rounded-full border-2", on ? "border-blue-600" : "border-slate-300")}>
        {on && <span className="size-2.5 rounded-full bg-blue-600" />}
      </span>
      {children}
    </button>
  );
}

/**
 * The CV as one professional paragraph.
 *
 * Generate with AI writes it from what the form holds and what the uploaded
 * papers said (the CV, the degree); it is then the person's to change - add,
 * reword or delete. Write Manually is a blank paragraph to type.
 */
export function CvField({ value, onChange, facts }) {
  const [way, setWay] = useState(value ? "manual" : "ai");
  const [editing, setEditing] = useState(!value);
  const [writing, setWriting] = useState(false);
  const [engine, setEngine] = useState("");

  const generate = async () => {
    setWriting(true);
    const read = await attempt(() => aiApi.cv(facts));
    setWriting(false);
    if (read?.summary) {
      onChange(read.summary);
      setEngine(read.available ? "ai" : read.reason === "unanswered" ? "unanswered" : "rules");
      setEditing(false);
    }
  };

  return (
    <section aria-label="Curriculum Vitae" className="rounded-xl border border-container-border p-4">
      <div className="flex flex-wrap items-start gap-4">
        <FileText className="mt-0.5 size-7 shrink-0 text-blue-700" strokeWidth={1.5} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-primary">Curriculum Vitae (CV)</h3>
          <p className="text-sm text-primary/75">
            Generate from your uploaded documents using AI, then review and edit it (add, modify, or delete) as needed.
          </p>
        </div>
        <div role="radiogroup" aria-label="How the CV is written" className="flex flex-wrap gap-2">
          <Way on={way === "ai"} onClick={() => setWay("ai")}>
            <Sparkles className="size-4 text-blue-600" aria-hidden="true" />
            Generate with AI <span className="font-normal text-blue-700">(Recommended)</span>
          </Way>
          <Way
            on={way === "manual"}
            onClick={() => {
              setWay("manual");
              setEditing(true);
            }}
          >
            Write Manually
          </Way>
        </div>
      </div>

      <div className="mt-4">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              aria-label="CV paragraph"
              value={value || ""}
              onChange={(event) => onChange(event.target.value)}
              rows={4}
              placeholder="A short professional summary: role, experience, specialisation, qualifications, languages."
            />
            <div className="flex flex-wrap gap-2">
              {way === "ai" && (
                <Button type="button" onClick={generate} disabled={writing}>
                  {writing ? <Loader size={16} className="me-2" label="Writing" /> : <Sparkles className="me-2 size-4" aria-hidden="true" />}
                  {value ? "Generate again" : "Generate CV"}
                </Button>
              )}
              {value && (
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  <Check className="me-2 size-4" aria-hidden="true" />
                  Done
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg bg-blue-50/60 px-4 py-3">
            <p className="flex-1 text-sm leading-relaxed text-primary">{value}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="me-1.5 size-3.5" aria-hidden="true" />
              Edit
            </Button>
          </div>
        )}
        {(engine === "rules" || engine === "unanswered") && !editing && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {engine === "unanswered"
              ? "Written from the details on file - the AI service did not answer. Review it before saving, or try again later."
              : "Written from the details on file - no AI service is connected. Review it before saving."}
          </p>
        )}
      </div>
    </section>
  );
}
