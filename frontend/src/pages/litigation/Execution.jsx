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
import { Hammer, ArrowLeft, Save, Plus } from "lucide-react";
import { Rial } from "@/components/shared/Rial";
import { withRial } from "@/lib/money";

import DateField from "@/components/shared/DateField";
const executionActions = [];

const columns = [
  { key: "date", header: "Date", width: "12%", cellClassName: "font-medium" },
  { key: "action", header: "Action", width: "20%" },
  {
    key: "status",
    header: "Status",
    width: "12%",
    render: (value) => (
      <Badge
        variant={
          value === "Completed"
            ? "success"
            : value === "In Progress"
            ? "brand"
            : "outline"
        }
      >
        {value}
      </Badge>
    )
  },
  // The figure carries the currency, so the heading does not repeat it.
  { key: "amount", header: "Amount", width: "12%", className: "text-end", cellClassName: "text-end", render: (value) => withRial(value) },
  { key: "notes", header: "Notes", width: "34%", cellClassName: "text-start" },
];

export default function Execution() {
  const { id } = useParams();
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: "",
    action: "",
    status: "",
    amount: "",
    notes: "",
  });

  // Moving to another case without unmounting: a form left open would still
  // be open over somebody else's file, with the last one's answers in it.
  const [loadedId, setLoadedId] = useState(id);
  if (id !== loadedId) {
    setLoadedId(id);
    setShowForm(false);
    setFormData({ date: "", action: "", status: "", amount: "", notes: "" });
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Adding execution action:", formData);
    setShowForm(false);
    setFormData({ date: "", action: "", status: "", amount: "", notes: "" });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <BackButton fallback="/litigation" />
        <div className="p-2 sm:p-3 rounded-xl bg-primary">
          <Hammer className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary">
            Execution
          </h1>
          <p className="text-xs sm:text-sm text-primary/75">
            Case No: {id || "2024/004"} - Manage judgement execution
          </p>
        </div>
      </div>

      {/* Case Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-medium">Global Trade Co</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Case Type</p>
              <p className="font-medium">Civil</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Court</p>
              <p className="font-medium">Appeal Court</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Awarded Amount</p>
              <p className="font-medium text-emerald-600">15,000.000 <Rial /></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="default">Execution</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className="text-2xl font-bold text-primary">15,000.000 <Rial /></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Recovered</p>
            <p className="text-2xl font-bold text-emerald-600">0.000 <Rial /></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-600">15,000.000 <Rial /></p>
          </CardContent>
        </Card>
      </div>

      {/* Add Action Form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* The way back out of the form, in the same place and with
                  the same mark as on every page that opens over another. */}
              <div className="flex items-center gap-3">
                <BackButton onBack={() => setShowForm(false)} />
                <h3 className="font-semibold text-primary">Add Execution Action</h3>
              </div>
              <div className="form-grid">
                <div className="form-field space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <DateField
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div data-required="true" className="form-field space-y-2">
                  <Label htmlFor="action">Action Type</Label>
                  <Select
                    value={formData.action}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, action: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Execution Order Filed">Execution Order Filed</SelectItem>
                      <SelectItem value="Bank Account Freeze">Bank Account Freeze</SelectItem>
                      <SelectItem value="Asset Seizure Notice">Asset Seizure Notice</SelectItem>
                      <SelectItem value="Travel Ban">Travel Ban</SelectItem>
                      <SelectItem value="Property Auction">Property Auction</SelectItem>
                      <SelectItem value="Payment Received">Payment Received</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div data-required="true" className="form-field space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (<Rial />)</Label>
                  <Input
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="0.000"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Enter action notes"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Save className="me-2 h-4 w-4" />
                  Save Action
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Execution Actions List */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="mb-4 font-semibold text-primary">Execution Actions</h3>
          <DataTable
            columns={columns}
            data={executionActions}
            searchPlaceholder="Search actions..."
            onAdd={showForm ? null : () => setShowForm(true)}
            addLabel="Add Action"
            currentPage={currentPage}
            totalPages={Math.ceil(executionActions.length / pageSize)}
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
