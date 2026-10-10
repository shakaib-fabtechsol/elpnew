import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  FileBarChart,
  Download,
  FileText,
  Users,
  Scale,
  Wallet,
  Briefcase,
  Calendar,
  Filter,
} from "lucide-react";

import DateField from "@/components/shared/DateField";
const reportTypes = [
  {
    id: 1,
    name: "Cases Summary Report",
    description: "Overview of all litigation cases by status and type",
    icon: Scale,
    category: "Litigation",
  },
  {
    id: 2,
    name: "Client Activity Report",
    description: "Client engagement and case history summary",
    icon: Users,
    category: "Clients",
  },
  {
    id: 3,
    name: "Invoice Aging Report",
    description: "Outstanding invoices by age and client",
    icon: Wallet,
    category: "Finance",
  },
  {
    id: 4,
    name: "Corporate Matters Report",
    description: "Summary of corporate legal matters and status",
    icon: Briefcase,
    category: "Corporate",
  },
  {
    id: 5,
    name: "Employee Performance Report",
    description: "Lawyer and staff case assignments and outcomes",
    icon: Users,
    category: "HR",
  },
  {
    id: 6,
    name: "Court Hearing Schedule",
    description: "Upcoming court hearings and deadlines",
    icon: Calendar,
    category: "Litigation",
  },
  {
    id: 7,
    name: "Revenue Report",
    description: "Monthly and yearly revenue analysis",
    icon: Wallet,
    category: "Finance",
  },
  {
    id: 8,
    name: "Case Outcome Analysis",
    description: "Win/loss ratio and case success metrics",
    icon: FileBarChart,
    category: "Litigation",
  },
];

const categories = ["All", "Litigation", "Clients", "Finance", "Corporate", "HR"];

export default function Reports() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredReports = selectedCategory === "All"
    ? reportTypes
    : reportTypes.filter(r => r.category === selectedCategory);

  const handleGenerate = (reportName) => {
    console.log("Generating report:", reportName, { dateFrom, dateTo });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-3 rounded-xl bg-primary">
          <FileBarChart className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary">
            Reports
          </h1>
          <p className="text-xs sm:text-sm text-primary/75">
            Generate and export system reports
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Date Range Filter */}
          <div className="form-grid">
            <div className="space-y-2">
              <Label htmlFor="dateFrom" className="text-xs">From Date</Label>
              <DateField
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo" className="text-xs">To Date</Label>
              <DateField
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Grid */}
      <div className="form-grid">
        {filteredReports.map((report) => (
          <Card key={report.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <report.icon className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {report.category}
                  </Badge>
                </div>

                <h3 className="font-semibold text-sm mb-2">{report.name}</h3>
                <p className="text-xs text-muted-foreground mb-4 flex-1">
                  {report.description}
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleGenerate(report.name)}
                  >
                    <FileText className="me-1 h-3 w-3" />
                    Generate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerate(report.name)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Report Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">156</p>
              <p className="text-xs text-muted-foreground">Reports Generated</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">45</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">8</p>
              <p className="text-xs text-muted-foreground">Report Types</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">PDF</p>
              <p className="text-xs text-muted-foreground">Export Format</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
