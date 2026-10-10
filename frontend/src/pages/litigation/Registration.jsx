import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGoBack } from "@/lib/useGoBack";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/shared/BackButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scale, Save, ArrowLeft } from "lucide-react";

import DateField from "@/components/shared/DateField";
import { useClients } from "@/lib/clients/context";
import { clientDisplayName } from "@/pages/clients/clientRecords";
import { employeeRecords } from "@/pages/employees/employeeData";
export default function Registration() {
  const { clients } = useClients();
  // The firm's lawyers, from the employee list.
  const lawyers = employeeRecords.filter(
    (person) => person.status !== "Inactive" && (person.occupation === "Lawyer" || person.practiceLevel)
  );
  const navigate = useNavigate();

  const goBack = useGoBack("/litigation");
  const [formData, setFormData] = useState({
    case_no: "",
    client: "",
    case_type: "",
    court: "",
    opponent: "",
    opponent_lawyer: "",
    subject: "",
    filing_date: "",
    assigned_lawyer: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Registering case:", formData);
    navigate("/litigation");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <BackButton fallback="/litigation" />
        <div className="p-2 sm:p-3 rounded-xl bg-primary">
          <Scale className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary">
            Case Registration
          </h1>
          <p className="text-xs sm:text-sm text-primary/75">
            Register a new litigation case
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-grid">
              <div className="form-field space-y-2">
                <Label htmlFor="case_no">Case Number</Label>
                <Input
                  id="case_no"
                  name="case_no"
                  value={formData.case_no}
                  onChange={handleChange}
                  placeholder="Enter case number"
                  required
                />
              </div>

              <div data-required="true" className="form-field space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select
                  value={formData.client}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, client: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.clientNo || client.id} value={clientDisplayName(client)}>
                        {clientDisplayName(client)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div data-required="true" className="form-field space-y-2">
                <Label htmlFor="case_type">Case Type</Label>
                <Select
                  value={formData.case_type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, case_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Civil">Civil</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Labor">Labor</SelectItem>
                    <SelectItem value="Criminal">Criminal</SelectItem>
                    <SelectItem value="Family">Family</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div data-required="true" className="form-field space-y-2">
                <Label htmlFor="court">Court</Label>
                <Select
                  value={formData.court}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, court: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select court" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Primary Court - Muscat">Primary Court - Muscat</SelectItem>
                    <SelectItem value="Primary Court - Salalah">Primary Court - Salalah</SelectItem>
                    <SelectItem value="Commercial Court">Commercial Court</SelectItem>
                    <SelectItem value="Appeal Court">Appeal Court</SelectItem>
                    <SelectItem value="Supreme Court">Supreme Court</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="form-field space-y-2">
                <Label htmlFor="opponent">Opponent Name</Label>
                <Input
                  id="opponent"
                  name="opponent"
                  value={formData.opponent}
                  onChange={handleChange}
                  placeholder="Enter opponent name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="opponent_lawyer">Opponent Lawyer</Label>
                <Input
                  id="opponent_lawyer"
                  name="opponent_lawyer"
                  value={formData.opponent_lawyer}
                  onChange={handleChange}
                  placeholder="Enter opponent lawyer"
                />
              </div>

              <div className="form-field space-y-2 sm:col-span-2">
                <Label htmlFor="subject">Case Subject</Label>
                <Input
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Enter case subject"
                  required
                />
              </div>

              <div className="form-field space-y-2">
                <Label htmlFor="filing_date">Filing Date</Label>
                <DateField
                  id="filing_date"
                  name="filing_date"
                  value={formData.filing_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div data-required="true" className="form-field space-y-2">
                <Label htmlFor="assigned_lawyer">Assigned Lawyer</Label>
                <Select
                  value={formData.assigned_lawyer}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, assigned_lawyer: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select lawyer" />
                  </SelectTrigger>
                  <SelectContent>
                    {lawyers.map((person) => (
                      <SelectItem key={person.id} value={person.name}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="me-2 h-4 w-4" />
                Register Case
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
