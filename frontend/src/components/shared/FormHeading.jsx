import BackButton from "./BackButton";

/**
 * The heading of a section, or of a form that opened over one.
 *
 * Two marks are always there: the rule down the left, and the icon. The icon
 * is what tells this heading apart from the page's own heading above it -
 * without one, two bold blue lines in the same column read as the same thing
 * said twice. The way back is not always there: it belongs only where the form
 * took the whole page, so there is nothing behind it to look at. Where the list
 * is still underneath, an arrow would offer to leave a page nobody left.
 */
export default function FormHeading({ title, note, icon: Icon, onBack }) {
  return (
    <div className="flex items-center gap-3">
      {onBack && <BackButton onBack={onBack} />}
      <div className="flex items-center gap-2 border-s-4 border-primary ps-3">
        {Icon && (
          <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        )}
        <div>
          <p className="text-lg font-bold text-primary">{title}</p>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>
    </div>
  );
}
