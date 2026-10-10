/**
 * A titled panel inside a form.
 *
 * The title sits in a bar of its own rather than floating above the fields, so
 * a long form reads as a few named parts instead of one run of inputs. The
 * icon is the same mark every heading below the top of a page carries: it is
 * what says this names a part rather than the page.
 */
export default function Panel({ title, icon: Icon, children }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <p className="flex items-center gap-2 border-b bg-secondary/60 px-4 py-3 text-base font-bold text-primary">
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {title}
      </p>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}
