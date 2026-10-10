import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Save, User, Mail, Phone, Building, Calendar, BadgeCheck } from "lucide-react";

import DateField from "@/components/shared/DateField";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import { employeeRecords } from "@/pages/employees/employeeData";
export default function ProfileInfo() {
  const [saved, setSaved] = useState(false);
  // Whoever is signed in, and their employee record if they have one.
  const me = employeeRecords.find((e) => e.id === CURRENT_USER.employeeId) || {};
  const [formData, setFormData] = useState({
    name_en: CURRENT_USER.name || "",
    name_ar: me.nameAr || "",
    email: CURRENT_USER.email || me.workEmail || "",
    mobile: me.phone ? (me.dialCode || "+968") + " " + me.phone : "",
    designation: me.occupation || "",
    department: me.department || "",
    branch: me.branch || "",
    joining_date: me.dateOfJoining || "",
    employee_id: me.empNo || "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-3 rounded-xl bg-primary">
          <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            My Profile
          </h1>
          <p className="text-xs sm:text-sm text-primary/75">
            Manage your personal information
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl sm:text-2xl">
                <User className="h-10 w-10 sm:h-12 sm:w-12" />
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-start">
              <h2 className="text-lg sm:text-xl font-bold">
                {formData.name_en}
              </h2>
              <p className="text-sm text-muted-foreground">{formData.designation}</p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                <BadgeCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">Active Employee</span>
              </div>
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Form Fields */}
          <div className="form-grid">
            <div className="space-y-2">
              <Label htmlFor="name_en" className="text-xs sm:text-sm font-medium">
                Full Name (English)
              </Label>
              <Input
                id="name_en"
                name="name_en"
                value={formData.name_en}
                onChange={handleChange}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name_ar" className="text-xs sm:text-sm font-medium">
                Full Name (Arabic)
              </Label>
              <Input
                id="name_ar"
                name="name_ar"
                value={formData.name_ar}
                onChange={handleChange}
                dir="rtl"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs sm:text-sm font-medium flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="h-10 lowercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile" className="text-xs sm:text-sm font-medium flex items-center gap-1">
                <Phone className="h-3 w-3" /> Mobile
              </Label>
              <Input
                id="mobile"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="designation" className="text-xs sm:text-sm font-medium">
                Designation
              </Label>
              <Input
                id="designation"
                name="designation"
                value={formData.designation}
                disabled
                className="h-10 bg-locked"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department" className="text-xs sm:text-sm font-medium flex items-center gap-1">
                <Building className="h-3 w-3" /> Department
              </Label>
              <Input
                id="department"
                name="department"
                value={formData.department}
                disabled
                className="h-10 bg-locked"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch" className="text-xs sm:text-sm font-medium">
                Branch
              </Label>
              <Input
                id="branch"
                name="branch"
                value={formData.branch}
                disabled
                className="h-10 bg-locked"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="joining_date" className="text-xs sm:text-sm font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Joining Date
              </Label>
              <DateField
                id="joining_date"
                name="joining_date"
                value={formData.joining_date}
                disabled
                className="h-10 bg-locked"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_id" className="text-xs sm:text-sm font-medium">
                Employee ID
              </Label>
              <Input
                id="employee_id"
                name="employee_id"
                value={formData.employee_id}
                disabled
                className="h-10 bg-locked"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-center sm:justify-end mt-6 sm:mt-8">
            <Button
              className="w-full sm:w-auto"
              onClick={() => setSaved(true)}
            >
              <Save className="me-2 h-4 w-4" />
              {saved ? "Saved" : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
