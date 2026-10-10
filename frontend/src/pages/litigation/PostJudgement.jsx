import { useState } from "react";
import UploadIcon from "@/components/shared/UploadIcon";
import { useNavigate, useParams } from "react-router-dom";
import { useGoBack } from "@/lib/useGoBack";
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
import { FileCheck, ArrowLeft, Save } from "lucide-react";
import { Rial } from "@/components/shared/Rial";

import DateField from "@/components/shared/DateField";
export default function PostJudgement() {
  const navigate = useNavigate();

  const goBack = useGoBack("/litigation");
  const { id } = useParams();
  const [judgementFile, setJudgementFile] = useState(null);
  const [formData, setFormData] = useState({
    judgement_date: "",
    judgement_type: "",
    judgement_summary: "",
    appeal_deadline: "",
    appeal_status: "",
    awarded_amount: "",
    court_costs: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Saving post judgement:", formData);
    navigate("/litigation");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <BackButton fallback="/litigation" />
        <div className="p-2 sm:p-3 rounded-xl bg-primary">
          <FileCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary">
            Post Judgement
          </h1>
          <p className="text-xs sm:text-sm text-primary/75">
            Case No: {id || "2024/003"} - Manage judgement details
          </p>
        </div>
      </div>

      {/* Case Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-medium">Ali Mohammed</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Case Type</p>
              <p className="font-medium">Labor</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Court</p>
              <p className="font-medium">Primary Court - Salalah</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="warning">Post Judgement</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Judgement Details Form */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="font-semibold text-primary">Judgement Details</h3>

            <div className="form-grid">
              <div className="form-field space-y-2">
                <Label htmlFor="judgement_date">Judgement Date</Label>
                <DateField
                  id="judgement_date"
                  name="judgement_date"
                  value={formData.judgement_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div data-required="true" className="form-field space-y-2">
                <Label htmlFor="judgement_type">Judgement Type</Label>
                <Select
                  value={formData.judgement_type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, judgement_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In Favor">In Favor</SelectItem>
                    <SelectItem value="Against">Against</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appeal_deadline">Appeal Deadline</Label>
                <DateField
                  id="appeal_deadline"
                  name="appeal_deadline"
                  value={formData.appeal_deadline}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appeal_status">Appeal Status</Label>
                <Select
                  value={formData.appeal_status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, appeal_status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not Filed">Not Filed</SelectItem>
                    <SelectItem value="Filed">Filed</SelectItem>
                    <SelectItem value="Withdrawn">Withdrawn</SelectItem>
                    <SelectItem value="Deadline Passed">Deadline Passed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="awarded_amount">Awarded Amount (<Rial />)</Label>
                <Input
                  id="awarded_amount"
                  name="awarded_amount"
                  value={formData.awarded_amount}
                  onChange={handleChange}
                  placeholder="0.000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="court_costs">Court Costs (<Rial />)</Label>
                <Input
                  id="court_costs"
                  name="court_costs"
                  value={formData.court_costs}
                  onChange={handleChange}
                  placeholder="0.000"
                />
              </div>

              <div className="space-y-2 sm:col-span-2 lg:col-span-4">
                <Label htmlFor="judgement_summary">Judgement Summary</Label>
                <Input
                  id="judgement_summary"
                  name="judgement_summary"
                  value={formData.judgement_summary}
                  onChange={handleChange}
                  placeholder="Enter judgement summary"
                />
              </div>
            </div>

            {/* Document Upload Section */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-primary mb-4">Judgement Documents</h3>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <UploadIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop judgement documents here, or click to browse
                </p>
                <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files[0] && setJudgementFile(e.target.files[0])
                    }
                  />
                  {judgementFile ? judgementFile.name : "Browse Files"}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="me-2 h-4 w-4" />
                Save Details
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
