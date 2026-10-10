import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/shared/BackButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import { Gavel, Plus, ArrowLeft, Calendar, Save } from "lucide-react";

import DateField from "@/components/shared/DateField";
const hearings = [];

const columns = [
  { key: "date", header: "Hearing Date", width: "15%", cellClassName: "font-medium" },
  { key: "type", header: "Hearing Type", width: "18%" },
  {
    key: "outcome",
    header: "Outcome",
    width: "12%",
    render: (value) => (
      <Badge variant={value === "Adjourned" ? "warning" : "outline"}>
        {value}
      </Badge>
    )
  },
  { key: "next_date", header: "Next Date", width: "15%" },
  { key: "notes", header: "Notes", width: "30%", cellClassName: "text-start" },
];

export default function CourtHearing() {
  const { id } = useParams();
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: "",
    type: "",
    outcome: "",
    next_date: "",
    notes: "",
  });

  // Moving to another case without unmounting: a form left open would still
  // be open over somebody else's hearings, with the last one's answers in it.
  const [loadedId, setLoadedId] = useState(id);
  if (id !== loadedId) {
    setLoadedId(id);
    setShowForm(false);
    setFormData({ date: "", type: "", outcome: "", next_date: "", notes: "" });
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Adding hearing:", formData);
    setShowForm(false);
    setFormData({ date: "", type: "", outcome: "", next_date: "", notes: "" });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <BackButton fallback="/litigation" />
        <div className="p-2 sm:p-3 rounded-xl bg-primary">
          <Gavel className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary">
            Court Hearings
          </h1>
          <p className="text-xs sm:text-sm text-primary/75">
            Case No: {id || "2024/001"} - Manage court hearing sessions
          </p>
        </div>
      </div>

      {/* Case Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-medium">ABC Holdings LLC</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Case Type</p>
              <p className="font-medium">Civil</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Court</p>
              <p className="font-medium">Primary Court - Muscat</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="brand">Court Hearing</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Hearing Form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* The way back out of the form, in the same place and with
                  the same mark as on every page that opens over another. */}
              <div className="flex items-center gap-3">
                <BackButton onBack={() => setShowForm(false)} />
                <h3 className="font-semibold text-primary">Add New Hearing</h3>
              </div>
              <div className="form-grid">
                <div className="form-field space-y-2">
                  <Label htmlFor="date">Hearing Date</Label>
                  <DateField
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div data-required="true" className="form-field space-y-2">
                  <Label htmlFor="type">Hearing Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="First Hearing">First Hearing</SelectItem>
                      <SelectItem value="Evidence Submission">Evidence Submission</SelectItem>
                      <SelectItem value="Witness Examination">Witness Examination</SelectItem>
                      <SelectItem value="Final Arguments">Final Arguments</SelectItem>
                      <SelectItem value="Judgement">Judgement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outcome">Outcome</Label>
                  <Select
                    value={formData.outcome}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, outcome: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Adjourned">Adjourned</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="next_date">Next Hearing Date</Label>
                  <DateField
                    id="next_date"
                    name="next_date"
                    value={formData.next_date}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Enter hearing notes"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Save className="me-2 h-4 w-4" />
                  Save Hearing
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Hearings List */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="mb-4 font-semibold text-primary">Hearing History</h3>
          <DataTable
            columns={columns}
            data={hearings}
            searchPlaceholder="Search hearings..."
            onAdd={showForm ? null : () => setShowForm(true)}
            addLabel="Add Hearing"
            currentPage={currentPage}
            totalPages={Math.ceil(hearings.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            showExport={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
