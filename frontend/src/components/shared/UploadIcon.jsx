import { UploadCloud } from "lucide-react";

/**
 * The one upload mark in the system.
 *
 * Named here rather than reached for out of the icon set each time, so every
 * "attach a file" control carries the same mark and a change of mind is one
 * edit rather than fifteen.
 */
export default function UploadIcon(props) {
  return <UploadCloud {...props} />;
}
