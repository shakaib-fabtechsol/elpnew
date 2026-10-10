import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trailFor } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * The head of a page: where it sits, what it is, what it holds, and what can
 * be added to it.
 *
 * Every list in the system is topped by the same parts in the same places, so
 * they are written once here rather than a dozen times over. The trail above
 * the title is read from the header's own menus rather than passed in by each
 * page: one list of where pages live, so a page moved between menus cannot go
 * on claiming the old one.
 *
 * The action sits at the logical end of the title's row - a person looking up
 * from the table finds the page's name and the way to add to it together,
 * instead of hunting for the button among the search and filter controls.
 */
export default function PageHeader({
  icon: Icon,
  title,
  note,
  onAdd,
  addLabel = "Add",
  action,
  className,
  // A page opened from a list - adding to it, say - names itself at the end
  // of the trail and offers the way back to the list beside its title.
  crumb,
  backTo,
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const trail = trailFor(pathname);

  return (
    // Set in by the same amount the card below it insets its own contents, so
    // the trail, the rule and the table all begin on one line down the page.
    <div className={cn("space-y-2 px-4 sm:px-6", className)}>
      {/* Which menu this page came out of, and which page it is. Quiet above
          the title, because it answers where rather than what. */}
      {trail?.section && (
        // Flush with the rule below it, so the head of the page has one left
        // edge rather than a trail set in from the title it belongs to.
        <nav aria-label="Breadcrumb" className="text-sm">
          <span className="text-primary/60">{trail.section}</span>
          <span aria-hidden="true" className="px-2 text-primary/40">
            /
          </span>
          {crumb ? (
            <>
              <span className="text-primary/60">{trail.page}</span>
              <span aria-hidden="true" className="px-2 text-primary/40">
                /
              </span>
              <span className="font-semibold text-primary" aria-current="page">
                {crumb}
              </span>
            </>
          ) : (
            <span className="font-semibold text-primary" aria-current="page">
              {trail.page}
            </span>
          )}
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          {backTo && (
            <button
              type="button"
              onClick={() => navigate(backTo)}
              title={"Back to " + (trail?.page || "the list")}
              className="mt-1 flex size-9 shrink-0 items-center justify-center self-start rounded-md text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
              <span className="sr-only">Back to {trail?.page || "the list"}</span>
            </button>
          )}
          {/* The rule down the start, then the icon, then the name - the same
              three-part heading the form containers use, one size up. */}
          <span
            aria-hidden="true"
            className="mt-1 w-1 shrink-0 self-stretch rounded-full bg-primary"
          />
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-xl font-bold text-primary sm:text-2xl">
              {Icon && (
                <Icon
                  strokeWidth={1.5}
                  className="size-6 shrink-0 sm:size-7"
                  aria-hidden="true"
                />
              )}
              {title}
            </h1>
            {note && (
              <p className="mt-1 text-xs text-primary/75 sm:text-sm">{note}</p>
            )}
          </div>
        </div>

        {/* `action` is for a page needing something other than adding, or more
            than one thing; `onAdd` is the ordinary case written short. */}
        {(action || onAdd) && (
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {onAdd && (
              <Button type="button" variant="add" onClick={onAdd}>
                <Plus className="me-2 h-4 w-4" />
                {addLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
