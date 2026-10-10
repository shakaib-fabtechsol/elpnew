/**
 * The mark on the export control.
 *
 * Drawn rather than taken from the icon set: a generic spreadsheet outline
 * says "a table", while this says "the file you will get is one Excel opens",
 * which is the only question anybody asks of that button.
 *
 * Excel's mark as the design shows it: a green cover, opened like a book,
 * carrying a white X, and beside it a sheet of green cells. Nothing finer: at
 * the size a toolbar gives an icon, detail that cannot be resolved reads as
 * blur rather than as detail.
 */
export default function ExcelIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* The sheet beside the cover, with its edge and its cells. */}
      <rect
        x="10.4"
        y="4.2"
        width="11.6"
        height="15.6"
        rx="0.8"
        fill="#FFFFFF"
        stroke="#217346"
        strokeWidth="1.3"
      />
      <path
        d="M13 7.6h7.4M13 10.6h7.4M13 13.6h7.4M13 16.6h7.4M16.7 4.2v15.6"
        stroke="#217346"
        strokeWidth="1.1"
      />

      {/* The cover, its near edge taller than its far one, as a book opens. */}
      <path d="M2 4.4 13.6 2.2v19.6L2 19.6V4.4Z" fill="#217346" />

      {/* The X on the cover. */}
      <path
        d="m5 8.2 5.4 7.6m0-7.6L5 15.8"
        stroke="#FFFFFF"
        strokeWidth="2.3"
      />
    </svg>
  );
}
