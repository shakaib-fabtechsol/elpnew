import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  KeyRound,
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Each rule is checked as the user types. The list is on screen from the start
 * rather than appearing after a failed submit, so the target is known up front.
 */
const RULES = [
  { key: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { key: "lower", label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { key: "number", label: "One number", test: (v) => /\d/.test(v) },
  { key: "symbol", label: "One symbol", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const STRENGTH = [
  { label: "Enter a password", tone: "bg-muted", text: "text-muted-foreground" },
  { label: "Very weak", tone: "bg-red-500", text: "text-red-600" },
  { label: "Weak", tone: "bg-red-500", text: "text-red-600" },
  { label: "Fair", tone: "bg-amber-500", text: "text-amber-600" },
  { label: "Good", tone: "bg-amber-500", text: "text-amber-600" },
  { label: "Strong", tone: "bg-green-600", text: "text-green-600" },
];

function PasswordField({ id, label, value, onChange, autoComplete, error, hint }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {hint}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className={cn("h-11 pe-11", error && "border-destructive")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute end-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="sr-only">
            {visible ? "Hide password" : "Show password"}
          </span>
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function ChangePassword() {
  const navigate = useNavigate();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  const passed = RULES.filter((rule) => rule.test(next));
  const strength = STRENGTH[next.length === 0 ? 0 : passed.length];
  const meetsRules = passed.length === RULES.length;
  const matches = confirm.length > 0 && confirm === next;

  const handleSubmit = (e) => {
    e.preventDefault();
    const found = {};

    if (!current) found.current = "Enter your current password.";
    if (!meetsRules) found.next = "The new password does not meet every rule.";
    else if (next === current)
      found.next = "The new password must differ from the current one.";
    if (confirm !== next) found.confirm = "The two passwords do not match.";

    setErrors(found);
    if (Object.keys(found).length) return;

    // No auth layer yet, so the change is acknowledged rather than sent.
    setSaved(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  if (saved) {
    return (
      <div className="mx-auto flex max-w-md flex-col justify-center py-12">
        <Card>
          <CardContent className="space-y-5 p-8 text-center">
            <div className="mx-auto w-fit rounded-full bg-green-50 p-4">
              <ShieldCheck className="h-9 w-9 text-green-600" />
            </div>
            <h2 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">
              Password updated
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="outline" onClick={() => setSaved(false)}>
                Change again
              </Button>
              <Button onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-secondary text-primary hover:bg-accent"
          onClick={() => navigate(-1)}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="rounded-xl bg-secondary p-3">
          <KeyRound className="h-6 w-6 text-secondary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary sm:text-2xl">
            Change Password
          </h1>
          <p className="text-xs text-primary/75 sm:text-sm">
            Update the password used to sign in
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-7">
            <PasswordField
              id="currentPassword"
              label="Current Password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              error={errors.current}
            />

            <div className="border-t pt-7">
              <div className="space-y-4">
                <PasswordField
                  id="newPassword"
                  label="New Password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                  error={errors.next}
                  hint={
                    <span className={cn("text-xs font-medium", strength.text)}>
                      {strength.label}
                    </span>
                  }
                />

                {/* Strength meter - one segment per rule met */}
                <div className="flex h-1.5 gap-1">
                  {RULES.map((rule, i) => (
                    <span
                      key={rule.key}
                      className={cn(
                        "flex-1 rounded-full transition-colors",
                        next.length > 0 && i < passed.length
                          ? strength.tone
                          : "bg-muted"
                      )}
                    />
                  ))}
                </div>

                {/* Requirements are visible before typing, not only after */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="mb-2.5 text-xs font-semibold text-foreground">
                    Password must contain
                  </p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {RULES.map((rule) => {
                      const ok = rule.test(next);
                      return (
                        <li
                          key={rule.key}
                          className={cn(
                            "flex items-center gap-2 text-xs transition-colors",
                            ok ? "text-green-600" : "text-muted-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                              ok ? "bg-green-100" : "bg-muted"
                            )}
                          >
                            {ok ? (
                              <Check className="h-2.5 w-2.5" />
                            ) : (
                              <X className="h-2.5 w-2.5" />
                            )}
                          </span>
                          {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            <PasswordField
              id="confirmPassword"
              label="Confirm New Password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              error={errors.confirm}
              hint={
                matches ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <Check className="h-3 w-3" />
                    Matches
                  </span>
                ) : null
              }
            />

            <div className="flex flex-col gap-2 border-t pt-6 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="sm:w-32"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!current || !meetsRules || !matches}
                className="sm:w-44"
              >
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
