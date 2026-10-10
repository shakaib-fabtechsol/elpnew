import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MessageCircle, Mail } from "lucide-react";
import PhoneInput from "@/components/shared/PhoneInput";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * A notification channel, switched on or off.
 *
 * Stored as "Yes"/"No" the way it always was - the switch changes how the
 * setting is asked for, not what the client record holds.
 */
function NotificationToggle({ id, icon, label, value, onChange }) {
  const Icon = icon;
  const on = value === "Yes";

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      {/* The height of a field, so the row stays level with the ones
          beside it. */}
      <div className="flex h-9 items-center gap-2">
        <Switch
          id={id}
          checked={on}
          onCheckedChange={(next) => onChange(next ? "Yes" : "No")}
        />
        <span
          className={cn(
            "text-sm font-medium",
            on ? "text-green-600" : "text-muted-foreground"
          )}
        >
          {on ? "ON" : "OFF"}
        </span>
      </div>
    </div>
  );
}

export default function ContactSection({ formData, onChange, onSelectChange }) {
  return (
    // Three to a row, the width every form in the system is laid out on.
    <div className="form-grid form-grid-3">
      {/* Mobile - the country code is picked, not typed into the number */}
      <div className="form-field space-y-2">
        <Label htmlFor="mobile">Mobile Number</Label>
        <PhoneInput
          id="mobile"
          name="mobile"
          dialCode={formData.mobileDialCode}
          onDialCode={(value) => onSelectChange("mobileDialCode", value)}
          value={formData.mobile}
          onChange={onChange}
          placeholder="XXXX XXXX"
        />
      </div>

      {/* Email */}
      <div className="form-field space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={onChange}
          placeholder="Enter email address"
          required
        />
      </div>

      {/* Communication Methods */}
      <div className="space-y-2 sm:col-span-2 lg:col-span-4">
        <p className="text-sm font-semibold text-primary">
          Communication Methods
        </p>
      </div>

      {/* Language of Communication */}
      <div className="space-y-2">
        <Label htmlFor="languageOfCommunication">
          Language of Communication *
        </Label>
        <Select
          value={formData.languageOfCommunication}
          onValueChange={(value) =>
            onSelectChange("languageOfCommunication", value)
          }
        >
          <SelectTrigger id="languageOfCommunication">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Arabic">Arabic</SelectItem>
            <SelectItem value="English">English</SelectItem>
            <SelectItem value="Both">Both (Arabic &amp; English)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Both channels are a switch rather than a list: on or off is the
          whole of the setting, and it reads at a glance. */}
      <NotificationToggle
        id="whatsappNotification"
        icon={MessageCircle}
        label="Instant WhatsApp Notification"
        value={formData.whatsappNotification}
        onChange={(value) => onSelectChange("whatsappNotification", value)}
      />

      <NotificationToggle
        id="emailNotification"
        icon={Mail}
        label="Instant Email Notification"
        value={formData.emailNotification}
        onChange={(value) => onSelectChange("emailNotification", value)}
      />

      {/* Which events actually reach the client is decided by the event
          itself, not explained here: the page carries no prose. */}
    </div>
  );
}
