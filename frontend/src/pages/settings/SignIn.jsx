import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useFirm } from "@/lib/firm/context";
import { signIn } from "@/lib/api/session";
import logo from "@/assets/logonew.jpeg";

/**
 * Signing in to the SADEED API. Shown by the session gate whenever nobody is
 * signed in - on first visit, after Sign Out, or when a session has expired.
 */
export default function SignIn({ onSignedIn }) {
  const navigate = useNavigate();
  const { firmInfo } = useFirm();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim(), password);
      navigate("/dashboard");
      onSignedIn?.();
    } catch (failure) {
      setError(failure.field?.("email") || failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-6 p-6">
          <div className="text-center">
            <img
              src={logo}
              alt={firmInfo.nameEn}
              className="mx-auto h-12 w-auto"
            />
            <p className="mt-2 text-xs text-muted-foreground" dir="rtl">
              {firmInfo.nameAr}
            </p>
          </div>

          <form className="space-y-4" onSubmit={submit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="signInEmail">Email</Label>
              <Input
                id="signInEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                aria-invalid={Boolean(error)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signInPassword">Password</Label>
              <div className="relative">
                <Input
                  id="signInPassword"
                  type={visible ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pe-10"
                  aria-invalid={Boolean(error)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {visible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {visible ? "Hide password" : "Show password"}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy || !email || !password}>
              {busy ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="me-2 h-4 w-4" />
              )}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
