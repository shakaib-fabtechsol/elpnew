/**
 * Expense taxonomy.
 *
 * The four general types - Office, Administrative & Financial, Marketing and
 * Other - follow the strict three-level structure the General Invoices
 * specification sets out:
 *
 *   Expense Type -> Category -> Subcategory
 *
 * The types that belong to their own records (cases, employees, partners,
 * assets) are kept here too. They are not raised through General Invoices, but
 * the client asked that none of that work be removed - each will be surfaced on
 * its own page.
 *
 * `link` names the record such an expense must be tied to, so choosing one of
 * those types reveals a mandatory record picker.
 */

export const LEVEL_LABELS = ["Expense Type", "Category", "Subcategory"];

const subs = (names) => names.map((name) => ({ name }));

/**
 * The kinds of property the firm rents. Rent is classified by them, and a
 * lease names one - the same list for both, so a rent payment is always booked
 * under the property type its lease is for.
 */
export const RENT_PROPERTY_TYPES = [
  "Office",
  "Office Annex",
  "Apartment",
  "Storage",
  "Warehouse",
  "Parking",
];

export const EXPENSE_TYPES = [
  /* ----------------------------------------- 1. Office Expenses (general) */
  {
    key: "office",
    name: "Office Expenses",
    link: null,
    inGeneralInvoices: true,
    children: [
      {
        name: "Rent",
        // Named for what it holds, wherever the picker shows it.
        childLabel: "Property Type",
        children: subs(RENT_PROPERTY_TYPES),
      },
      {
        name: "Utilities & Services",
        children: subs([
          "Electricity",
          "Water",
          "Sewerage Services",
          "Other Utility Services",
        ]),
      },
      {
        name: "Internet & Telecommunications",
        children: subs([
          "Internet",
          "Landline",
          "Mobile Phones",
          "SIM Cards & Data Plans",
          "Mobile Recharge",
          "Installation & Activation",
          "Other Telecommunications Services",
        ]),
      },
      {
        name: "Stationery & Printing",
        children: subs([
          "Printing Paper",
          "Printer Ink & Toner",
          "Pens & Office Stationery",
          "Files & Folders",
          "Notebooks & Notepads",
          "Document Printing & Photocopying",
          "Business Cards",
          "Office Stamps",
          "Other Printing Materials",
        ]),
      },
      {
        name: "Food & Hospitality",
        children: subs([
          "Food & Beverages",
          "Meeting & Visitor Hospitality",
          "Office Events",
          "Other Hospitality Expenses",
        ]),
      },
      {
        name: "Cleaning",
        children: subs([
          "Cleaning Materials & Supplies",
          "Cleaning Services",
          "Pest Control",
          "Air Fresheners & Cleaning Products",
        ]),
      },
      {
        name: "Office Maintenance",
        children: subs([
          "Electrical Maintenance",
          "Plumbing Maintenance",
          "Doors & Locks Maintenance",
          "Painting & General Repairs",
          "General Office Maintenance",
        ]),
      },
      {
        name: "Software & Subscriptions",
        children: subs([
          "Software Subscriptions",
          "Cloud Storage",
          "Email Subscriptions",
          "Software Licenses",
          "AI Subscriptions",
          "Websites & Online Services",
          "Website Design & Development",
          "Other Software & Technology Services",
        ]),
      },
      {
        name: "Postage & Courier",
        children: subs([
          "Local Postage & Shipping",
          "International Postage & Shipping",
          "Delivery Services",
        ]),
      },
      {
        name: "Office Supplies",
        children: subs([
          "General Office Supplies",
          "Kitchen Supplies",
          "Bathroom Supplies",
          "Other Consumable Supplies",
        ]),
      },
      {
        name: "Security & Safety",
        children: subs([
          "Security & Surveillance Systems",
          "Alarm & Safety Systems",
          "Fire Extinguishers & Safety Supplies",
          "Security Guard Services",
          "Other Security & Safety Expenses",
        ]),
      },
    ],
  },

  /* ------------------------------ 2. Administrative & Financial Expenses */
  {
    key: "admin-financial",
    name: "Administrative & Financial Expenses",
    link: null,
    inGeneralInvoices: true,
    children: [
      {
        name: "Bank Charges",
        children: subs([
          "Bank Transfer Fees",
          "Bank Commissions",
          "Card & POS Fees",
          "Banking Service Fees",
          "VAT on Bank Charges",
          "Other Bank Charges",
        ]),
      },
      {
        name: "Tax Payments",
        children: subs([
          "Value Added Tax (VAT)",
          "Income Tax",
          "Withholding Tax",
          "Tax Penalties & Fines",
          "Other Tax Payments",
        ]),
      },
      {
        // Vehicle insurance is deliberately absent - it is recorded against the
        // vehicle on the Fixed Asset page.
        name: "Insurance",
        children: subs([
          "Office Insurance",
          "Professional Liability Insurance",
          "Health or Group Insurance",
          "Other Insurance",
        ]),
      },
      {
        name: "Licenses & Renewals",
        children: subs([
          "Commercial Registration Renewal",
          "Office Licenses",
          "Government Permits & Fees",
          "Other Renewal Fees",
        ]),
      },
      {
        name: "Audit & Review",
        children: subs(["External Audit Fees", "Other Audit & Review Services"]),
      },
    ],
  },

  /* ------------------------------- 3. Marketing & Business Development */
  {
    key: "marketing",
    name: "Marketing & Business Development",
    link: null,
    inGeneralInvoices: true,
    children: [
      {
        name: "Advertising",
        children: subs([
          "Print Advertising",
          "Online Advertising",
          "Social Media Advertising",
          "Outdoor Advertising",
          "Other Advertising",
        ]),
      },
      {
        // Paid advertising lives under Advertising and is not repeated here.
        name: "Digital Marketing",
        children: subs([
          "Social Media Management",
          "Search Engine Optimization",
          "Content Creation",
          "Email Marketing",
          "Other Digital Marketing Services",
        ]),
      },
      {
        name: "Design & Printing",
        children: subs([
          "Branding & Marketing Material Design",
          "Marketing Material Printing",
          "Promotional Gifts & Materials",
          "Other Design & Printing",
        ]),
      },
      {
        name: "Events & Exhibitions",
        children: subs([
          "Participation Fees",
          "Event Setup",
          "Exhibition Fees",
          "Event Hospitality",
          "Other Event Expenses",
        ]),
      },
      {
        name: "Public Relations",
        children: subs([
          "Public Relations Services",
          "Media & Publications",
          "Photography & Media Production",
          "Other Public Relations Expenses",
        ]),
      },
      {
        name: "Business Development",
        children: subs([
          "Client Meetings",
          "Business Development Events",
          "Business Development Materials",
          "Client Gifts",
          "Other Business Development Expenses",
        ]),
      },
    ],
  },

  /* ---------------------------------------------- 4. Donations & Assistance */
  {
    // Requested over chat and kept, though it is not listed in the General
    // Invoices document.
    key: "donations",
    name: "Donations & Assistance",
    link: null,
    inGeneralInvoices: true,
    children: [
      {
        name: "Donations & Assistance",
        children: subs([
          "Social Assistance",
          "Donations",
          "Community Support",
          "Emergency Assistance",
          "Other Donations & Assistance",
        ]),
      },
    ],
  },

  /* ------------------------------------------------------ 5. Other Expenses */
  {
    // Only for genuinely exceptional items, so the description is compulsory.
    key: "other",
    name: "Other Expenses",
    link: null,
    inGeneralInvoices: true,
    requiresDescription: true,
    children: [
      { name: "Miscellaneous Expenses", children: subs(["Miscellaneous Expense"]) },
      { name: "One-Time Expenses", children: subs(["One-Time Expense"]) },
      { name: "Unclassified Expenses", children: subs(["Unclassified Expense"]) },
      { name: "Other Expenses", children: subs(["Other Expense"]) },
    ],
  },

  /* ------------- Types recorded on their own pages, kept and still usable */
  {
    key: "court-case",
    name: "Court & Case Expenses",
    link: "case",
    inGeneralInvoices: false,
    recordedOn: "Case page",
    children: [
      {
        name: "Court Fees",
        children: subs([
          "Case Filing Fees",
          "Appeal Fees",
          "Supreme Court Fees",
          "Petition Order Fees",
          "Grievance Fees",
          "Certificate Fees",
          "Judicial Notification Fees",
          "Expert Deposit Fees",
          "Translation Expenses",
          "Other Court Fees",
        ]),
      },
    ],
  },

  {
    key: "employee",
    name: "Employee Expenses",
    link: "employee",
    inGeneralInvoices: false,
    recordedOn: "Employee page",
    children: [
      {
        name: "Employee Expenses",
        children: subs([
          "Salaries",
          "Allowances",
          "Travel & Accommodation",
          "Training & Development",
          "Medical & Insurance",
          "Government Fees & Expenses",
        ]),
      },
    ],
  },

  {
    key: "advances-loans",
    name: "Employee Advances & Loans",
    link: "employee",
    inGeneralInvoices: false,
    recordedOn: "Employee page",
    children: [
      {
        name: "Advances & Loans",
        children: subs([
          "Employee Loan",
          "Salary Advance",
          "Other Employee Advance",
        ]),
      },
    ],
  },

  {
    key: "partner",
    name: "Partner Expenses",
    link: "partner",
    inGeneralInvoices: false,
    recordedOn: "Partner / Company page",
    children: [
      {
        name: "Partner Expenses",
        children: subs([
          "Bonuses & Entitlements",
          "Allowances",
          "Travel & Accommodation",
          "Hospitality & Meetings",
          "Professional Expenses",
          "Other Partner Expenses",
        ]),
      },
    ],
  },

  {
    key: "fixed-assets",
    name: "Fixed Asset Expenses",
    link: "asset",
    inGeneralInvoices: false,
    recordedOn: "Fixed Asset page",
    children: [
      {
        name: "Fixed Asset Purchase",
        children: subs([
          "Vehicles",
          "Office Furniture",
          "Computers & Laptops",
          "Printers & Photocopiers",
          "IT & Network Equipment",
          "Air Conditioning Units",
          "Other Fixed Assets",
        ]),
      },
      {
        name: "Asset Maintenance & Repairs",
        children: subs([
          "Vehicle Maintenance",
          "Equipment Maintenance",
          "Computer & Printer Maintenance",
          "Furniture Maintenance",
          "Air Conditioning Maintenance",
          "Other Asset Maintenance",
        ]),
      },
      {
        name: "Vehicle Registration & Insurance",
        children: subs([
          "Vehicle Registration & Renewal",
          "Vehicle Insurance",
          "Vehicle Inspection",
          "Other Vehicle Fees",
        ]),
      },
      {
        name: "Capital Improvements & Fit-Out",
        children: subs([
          "Office Fit-Out",
          "Renovation & Decoration",
          "Electrical & Network Installations",
          "Other Fixed Installations",
        ]),
      },
      {
        name: "Other Fixed Asset Expenses",
        children: subs(["Other Fixed Asset Expense"]),
      },
    ],
  },
];

/** Types that may be raised through General Invoices. */
export const GENERAL_TYPES = EXPENSE_TYPES.filter(
  (type) => type.inGeneralInvoices
);

/** Types that belong to a specific record and are entered on its own page. */
export const DEDICATED_TYPES = EXPENSE_TYPES.filter(
  (type) => !type.inGeneralInvoices
);

export const LINK_LABELS = {
  case: "Related Case",
  employee: "Related Employee",
  asset: "Related Fixed Asset",
  partner: "Related Partner",
};

/** Categories under a type. */
export const categoriesOf = (type) => type?.children || [];

/** Subcategories under the chosen category. */
export const subcategoriesOf = (type, categoryName) =>
  categoriesOf(type).find((c) => c.name === categoryName)?.children || [];

/** The options to offer at each level, given what has been chosen so far. */
export function optionsForPath(type, path) {
  if (!type) return [];
  const levels = [categoriesOf(type)];
  if (path[0]) {
    const subs = subcategoriesOf(type, path[0]);
    if (subs.length) levels.push(subs);
  }
  return levels;
}

/** A selection is complete once every level it offers has been answered. */
export function isPathComplete(type, path) {
  if (!type) return false;
  const levels = optionsForPath(type, path);
  return levels.length > 0 && path.filter(Boolean).length === levels.length;
}

export const expensePathLabel = (type, path) =>
  [type?.name, ...path].filter(Boolean).join(" › ");
