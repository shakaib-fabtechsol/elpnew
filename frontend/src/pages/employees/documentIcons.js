import {
  IdCard,
  BookUser,
  Award,
  GraduationCap,
  FileText,
  ScrollText,
  TrendingUp,
  ArrowLeftRight,
  TriangleAlert,
  CircleX,
  Users,
  MoreHorizontal,
} from "lucide-react";

/**
 * A mark for each kind of paper, and for each heading they are filed under.
 *
 * A list of twelve document types reads as twelve lines of text; with a mark
 * beside each one the eye finds the right line without reading the others.
 * The marks say what the paper *is* rather than decorating it - a cap for a
 * degree, a rising line for a promotion, an alert for a warning.
 *
 * Kept apart from the lists themselves because those are plain data the rest
 * of the system filters and compares on; only the screens need the marks.
 */
export const DOCUMENT_CATEGORY_ICON = {
  "Identity & Residency": IdCard,
  "Professional Licenses": Award,
  "Qualifications & Experience": GraduationCap,
  "Administrative Decisions": FileText,
};

export const DOCUMENT_TYPE_ICON = {
  // Identity & Residency
  "National ID": IdCard,
  Passport: BookUser,
  "Residence Card": IdCard,

  // Professional Licenses
  "Law Practice License": FileText,
  "Professional Membership Card": IdCard,

  // Qualifications & Experience
  CV: FileText,
  "University Degree": GraduationCap,
  "Experience Certificate": Award,
  "Training Certificate": ScrollText,

  // Administrative Decisions
  "Appointment Decision": FileText,
  "Promotion Decision": TrendingUp,
  "Transfer Decision": ArrowLeftRight,
  "Warning Decision": TriangleAlert,
  "Termination Decision": CircleX,
  "Committee Formation Decision": Users,
};

/** Whatever a category does not name falls to the catch-all's own mark. */
export const documentTypeIcon = (type) =>
  DOCUMENT_TYPE_ICON[type] || MoreHorizontal;

export const documentCategoryIcon = (category) =>
  DOCUMENT_CATEGORY_ICON[category] || FileText;
