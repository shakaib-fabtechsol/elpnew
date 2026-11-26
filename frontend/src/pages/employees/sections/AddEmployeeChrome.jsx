import { CheckCircle2, Pencil, Save, UserPlus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The frame Add Employee is filled in inside: the bar across the top, the
 * summary of who is being added, and the setup questions the first step
 * opens with. Kept here so EmployeeForm holds the fields and this holds the
 * frame around them.
 */

/** "19:42" as the bar says it: "7:42 PM". */
const clock = (date) =>
  date ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

/**
 * The navy bar across the top of Add Employee: what this is, that it is a
 * draft and when it was last kept, and the three ways out - keep the draft,
 * leave it, or create the employee.
 */
export function AddEmployeeBar({ savedAt, onSaveDraft, onCancel, onCreate, creating }) {
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl bg-[#0b2447] px-5 py-3.5 text-white">
      <span className="text-xl font-extrabold tracking-wide">SADEED</span>
      <span aria-hidden="true" className="hidden h-7 w-px bg-white/30 sm:block" />
      <h1 className="flex items-center gap-2.5 text-xl font-semibold">
        <UserPlus className="size-6" strokeWidth={1.75} aria-hidden="true" />
        Add Employee
      </h1>
      <div className="ms-auto flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">Draft</span>
        {savedAt && (
          <span className="flex items-center gap-1.5 text-sm" role="status">
            <CheckCircle2 className="size-4 fill-emerald-500 text-[#0b2447]" aria-hidden="true" />
            Auto-saved at {clock(savedAt)}
          </span>
        )}
        <Button type="button" variant="outline" className="bg-white text-primary hover:bg-white/90" onClick={onSaveDraft}>
          <Save className="me-2 size-4" aria-hidden="true" />
          Save Draft
        </Button>
        <Button type="button" variant="outline" className="bg-white text-primary hover:bg-white/90" onClick={onCancel}>
          <X className="me-2 size-4" aria-hidden="true" />
          Cancel
        </Button>
        <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={onCreate} disabled={creating}>
          Create Employee
          <Check className="ms-2 size-4" aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}

/** "Mohammed Ahmed" -> "MA". */
const initials = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .filter((_, index, all) => index === 0 || index === all.length - 1)
    .join("")
    .toUpperCase();

/**
 * Who is being added, from step two on: filled in from what was typed or read
 * off the papers, and redrawn whenever either changes. Only shows - nothing is
 * entered here; Edit Setup goes back to the questions the first step asked.
 */
export function EmployeeSummaryCard({ values, nonOmani, employeeNo, photoUrl, onEditSetup }) {
  const level = String(values.practiceLevel || "").replace(/\s*Lawyer$/i, "");
  const facts = [
    values.staffCategory === "Permanent" ? "Permanent Employee" : values.staffCategory,
    values.nationality || (nonOmani ? "Non-Omani" : ""),
    values.professionalClassification === "Lawyer"
      ? "Lawyer" + (level ? " – " + level : "")
      : values.professionalClassification,
    values.employmentType,
    values.paid === "No" ? "Unpaid" : "Paid (Salaried)",
    "Social Protection: " + (values.socialProtection === "Yes" ? "Yes" : "No"),
  ];
  const name = values.employeeName || "New Employee";

  return (
    <section
      aria-label="Employee summary"
      className="flex flex-wrap items-center gap-y-3 rounded-xl border border-container-border bg-card px-5 py-4"
    >
      <div className="flex items-center gap-3 pe-6">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-primary">
            {initials(values.employeeName) || "?"}
          </span>
        )}
        <div>
          <p className="text-lg font-bold leading-tight text-blue-800">{name}</p>
          <p className="numeric-value text-sm text-muted-foreground">{employeeNo}</p>
        </div>
      </div>
      {/* Subtle rules between the facts, and no icons: it is read across. */}
      {facts.map((fact, index) => (
        <span
          key={index}
          className="border-s border-container-border px-5 text-sm font-semibold text-primary"
        >
          {fact || "–"}
        </span>
      ))}
      <Button type="button" variant="outline" className="ms-auto" onClick={onEditSetup}>
        <Pencil className="me-2 size-4" aria-hidden="true" />
        Edit Setup
      </Button>
    </section>
  );
}

/** One question with two answers, as a pair of radio pills. */
function Choice({ label, value, options, onChange, required = true }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-primary">
        {label}
        {required && <span className="ms-0.5 text-red-600">*</span>}
      </legend>
      <div role="radiogroup" aria-label={label} className="flex gap-2">
        {options.map((option) => {
          const on = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(option)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-blue-200 bg-blue-50 text-primary" : "border-container-border bg-card text-primary/80 hover:bg-slate-50"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border-2",
                  on ? "border-blue-600" : "border-slate-300"
                )}
              >
                {on && <span className="size-2.5 rounded-full bg-blue-600" />}
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The questions Add Employee opens with. Each answer decides something
 * further on: which papers are asked for, which steps apply. Social
 * Protection is asked only of a permanent employee.
 */
export function SetupQuestions({ values, nonOmani, onAnswer }) {
  const nationality = values.nationality ? (values.nationality === "Omani" ? "Omani" : "Non-Omani") : nonOmani ? "Non-Omani" : "";
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-5 border-b border-container-border pb-5">
      <Choice label="Nationality" value={nationality} options={["Omani", "Non-Omani"]} onChange={(v) => onAnswer("nationality", v)} />
      <Choice
        label="Professional Classification"
        value={values.professionalClassification}
        options={["Lawyer", "Non-Lawyer"]}
        onChange={(v) => onAnswer("professionalClassification", v)}
      />
      <Choice
        label="Employment Type"
        value={values.staffCategory}
        options={["Permanent", "Intern / Trainee"]}
        onChange={(v) => onAnswer("staffCategory", v)}
      />
      <Choice label="Paid / Salary" value={values.paid} options={["Yes", "No"]} onChange={(v) => onAnswer("paid", v)} />
      {values.staffCategory === "Permanent" && (
        <Choice
          label="Social Protection"
          value={values.socialProtection}
          options={["Yes", "No"]}
          onChange={(v) => onAnswer("socialProtection", v)}
        />
      )}
    </div>
  );
}

/** "Required 2 / 4" and its bar: how many of the required papers are in. */
export function RequiredProgress({ done, total }) {
  const share = total ? Math.round((done / total) * 100) : 100;
  return (
    <div className="w-44 text-end">
      <p className="text-sm font-semibold text-primary">
        Required {done} / {total}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Required documents uploaded"
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200"
      >
        <span className="block h-full rounded-full bg-green-600 transition-all" style={{ width: share + "%" }} />
      </div>
    </div>
  );
}
