import { useState } from "react";
import { Link } from "react-router-dom";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The navigation for one record.
 *
 * It belongs to the record open in front of it and to nothing else: the name
 * at the top is that record's, and every link below leads to a side of the
 * same file. The groups, their labels, their links and whatever counts they
 * carry are handed in by the record's own model, so employees, clients and
 * cases share this one component rather than growing three of it.
 *
 * Groups somebody opened stay open for the rest of the session - moving
 * between two sides of a file should not mean opening the same group twice -
 * and the group holding whatever is on screen opens itself.
 */

/** What is open, remembered for as long as the tab is. */
function remembered(id, fallback) {
  try {
    const held = sessionStorage.getItem("sadeed.sidebar." + id);
    return held ? JSON.parse(held) : fallback;
  } catch {
    return fallback;
  }
}

function remember(id, value) {
  try {
    sessionStorage.setItem("sadeed.sidebar." + id, JSON.stringify(value));
  } catch {
    /* A tab that will not store this still has to navigate. */
  }
}

/** One link under a group: the name, and a count where the model gives one. */
function Child({ item, active, reachable, onSelect }) {
  return (
    <button
      type="button"
      // A closed group is out of the tab order, not merely out of sight.
      tabIndex={reachable ? 0 : -1}
      onClick={() => onSelect(item.key)}
      aria-current={active ? "page" : undefined}
      className={cn(
        // 16px past the parent's text, and the edge rides the logical start
        // so it changes sides with the language rather than staying left.
        //
        // Every child carries the edge, pale; the one being read carries it
        // navy. Run together down the group they read as one rule with the
        // current place marked on it, rather than a lone stripe floating
        // beside a row.
        "flex w-full items-center justify-between gap-2 rounded-[6px] border-s-[3px] py-2 pe-2.5 ps-4 text-start text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "border-s-primary bg-menu-selected font-semibold text-primary"
          : "border-s-container-border text-primary hover:bg-menu-hover"
      )}
    >
      <span className="truncate">{item.label}</span>
      {item.count !== undefined && (
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {item.count}
        </span>
      )}
    </button>
  );
}

export default function RecordSidebar({
  id = "record",
  backTo,
  backLabel = "Back",
  title,
  subtitle,
  groups = [],
  active,
  onSelect,
  className,
}) {
  // Radix places panels on a physical side, so the logical one is worked out
  // here: the rail sits at the start of the page, and its panels open away
  // from it - to the right in English, to the left in Arabic.
  const rtl =
    typeof document !== "undefined" && document.documentElement.dir === "rtl";

  // A group marked `link` is a section of its own rather than a heading over
  // several: it opens when clicked, and holds nothing.
  const groupHolding = (key) =>
    groups.find((group) => !group.link && group.items.some((item) => item.key === key));

  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // Opens on whatever was already showing, so the first thing anybody sees is
  // where they are - and falls back to the first group for a fresh record.
  const [open, setOpen] = useState(() =>
    remembered(id, [groupHolding(active)?.key || groups[0]?.key].filter(Boolean))
  );

  const isOpen = (key) => open.includes(key);

  const change = (next) => {
    setOpen(next);
    remember(id, next);
  };

  const toggle = (key) =>
    change(
      open.includes(key) ? open.filter((held) => held !== key) : [...open, key]
    );

  /**
   * Going to a section opens the group that holds it, and leaves every other
   * group as the person left it.
   *
   * The opening happens here, on the way to the section, rather than as a rule
   * that a group holding the open section is always open: that rule reads the
   * same from outside but makes the group impossible to close, because every
   * attempt is undone by the section still being the one on screen.
   */
  const select = (key) => {
    const group = groupHolding(key);
    if (group && !open.includes(group.key)) change([...open, group.key]);
    onSelect?.(key);
  };

  /** A section of its own at the top level: its icon and name, nothing under it. */
  const linkRow = (group, afterSelect) => {
    const Icon = group.icon;
    const current = active === group.key;
    return (
      <button
        key={group.key}
        type="button"
        onClick={() => {
          select(group.key);
          afterSelect?.();
        }}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-sm text-primary transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          current ? "bg-menu-selected font-bold" : "font-semibold hover:bg-menu-hover"
        )}
      >
        {Icon && <Icon strokeWidth={1.5} className="size-[18px] shrink-0" />}
        <span className="flex-1 truncate">{group.label}</span>
      </button>
    );
  };

  /** The groups as a plain open list, for the narrow-screen overlay. */
  const overlayGroups = (
    <div className="space-y-1 p-2">
      {groups.map((group) => {
        if (group.link) return linkRow(group, () => setSheetOpen(false));
        const Icon = group.icon;
        return (
          <div key={group.key}>
            <p className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-bold text-primary">
              {Icon && <Icon strokeWidth={1.5} className="size-[18px] shrink-0" />}
              {group.label}
            </p>
            <div className="ms-[18px] space-y-0.5">
              {group.items.map((item) => (
                <Child
                  key={item.key}
                  item={item}
                  active={active === item.key}
                  reachable
                  onSelect={(key) => {
                    select(key);
                    setSheetOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Below 768px there is no room for a rail beside the record, so the
          navigation becomes a panel called for when it is wanted - opening
          from the start side, which is the right one in Arabic. */}
      <div className="md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="cancel" className="w-full justify-start gap-2">
              <Menu strokeWidth={1.5} />
              {title || "Sections"}
            </Button>
          </SheetTrigger>
          <SheetContent side={rtl ? "right" : "left"} className="w-[312px] p-0">
            <SheetHeader className="border-b border-container-border p-4 text-start">
              <SheetTitle className="truncate text-lg font-bold text-primary">
                {title}
              </SheetTitle>
              {subtitle && (
                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
              )}
            </SheetHeader>
            {backTo && (
              <Link
                to={backTo}
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-1.5 px-4 pt-3 text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                {backLabel}
              </Link>
            )}
            {overlayGroups}
          </SheetContent>
        </Sheet>
      </div>

    <nav
      aria-label={title ? title + " sections" : "Record sections"}
      className={cn(
        "hidden w-full shrink-0 self-start rounded-container border border-container-border bg-card md:block",
        // Full height rather than only as tall as its links: a rail that stops
        // short reads as a box that failed to load, and the narrowed rail -
        // three icons and nothing else - stops shortest of all.
        "lg:sticky lg:top-[88px] lg:h-[calc(100vh-104px)] lg:overflow-y-auto",
        collapsed ? "lg:w-16" : "lg:w-[312px]",
        className
      )}
    >
      <div className={cn("p-4", collapsed && "lg:px-2")}>
        {backTo && !collapsed && (
          <Link
            to={backTo}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            {backLabel}
          </Link>
        )}

        <div className="flex items-start justify-between gap-2">
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-primary">{title}</p>
              {subtitle && (
                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((was) => !was)}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="hidden size-8 shrink-0 items-center justify-center rounded-md border border-container-border text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:flex"
          >
            {collapsed ? (
              <ChevronRight className="size-4 rtl:rotate-180" />
            ) : (
              <ChevronLeft className="size-4 rtl:rotate-180" />
            )}
            <span className="sr-only">
              {collapsed ? "Expand navigation" : "Collapse navigation"}
            </span>
          </button>
        </div>
      </div>

      <div
        className={cn(
          "space-y-1 border-t border-container-border p-2",
          collapsed && "lg:px-1"
        )}
      >
        {groups.map((group) => {
          const Icon = group.icon;

          if (group.link) {
            // Narrowed to icons, a section of its own is just its icon.
            if (collapsed) {
              return (
                <button
                  key={group.key}
                  type="button"
                  title={group.label}
                  onClick={() => select(group.key)}
                  aria-current={active === group.key ? "page" : undefined}
                  className={cn(
                    "hidden size-12 items-center justify-center rounded-md border-s-[3px] transition-colors lg:flex",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active === group.key
                      ? "border-s-primary bg-menu-selected text-primary"
                      : "border-s-transparent text-primary hover:bg-menu-hover"
                  )}
                >
                  {Icon && <Icon strokeWidth={1.5} className="size-5" />}
                  <span className="sr-only">{group.label}</span>
                </button>
              );
            }
            return linkRow(group);
          }

          const expanded = isOpen(group.key);
          const holds = group.items.some((item) => item.key === active);

          // Narrowed to icons, a group's children are read in a popover rather
          // than lost: an icon alone says nothing about what sits under it.
          if (collapsed) {
            return (
              // Not modal: this is navigation, so the Tab key carries on past
              // it into the page rather than being held inside the panel.
              <PopoverPrimitive.Root key={group.key} modal={false}>
                <PopoverPrimitive.Trigger asChild>
                  <button
                    type="button"
                    title={group.label}
                    className={cn(
                      "hidden size-12 items-center justify-center rounded-md border-s-[3px] transition-colors lg:flex",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      // The navy edge marks where the reader actually is,
                      // the same mark the expanded list uses.
                      holds
                        ? "border-s-primary bg-menu-selected text-primary"
                        : "border-s-transparent text-primary hover:bg-menu-hover"
                    )}
                  >
                    {Icon && <Icon strokeWidth={1.5} className="size-5" />}
                    <span className="sr-only">{group.label}</span>
                  </button>
                </PopoverPrimitive.Trigger>
                <PopoverPrimitive.Portal>
                  <PopoverPrimitive.Content
                    // Opens away from the rail, whichever side the rail is on.
                    side={rtl ? "left" : "right"}
                    align="start"
                    sideOffset={8}
                    collisionPadding={8}
                    className="z-50 w-[260px] rounded-container border border-container-border bg-card p-2 shadow-md"
                  >
                    <p className="px-2.5 pb-1.5 text-sm font-bold text-primary">
                      {group.label}
                    </p>
                    {group.items.map((item) => (
                      <Child
                        key={item.key}
                        item={item}
                        active={active === item.key}
                        reachable
                        onSelect={select}
                      />
                    ))}
                    {/* Points back at the icon it belongs to, so a panel
                        shifted to stay on screen still says where it came
                        from. */}
                    <PopoverPrimitive.Arrow
                      width={12}
                      height={6}
                      className="fill-card stroke-container-border"
                    />
                  </PopoverPrimitive.Content>
                </PopoverPrimitive.Portal>
              </PopoverPrimitive.Root>
            );
          }

          return (
            <div key={group.key}>
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={expanded}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-sm font-bold text-primary transition-colors",
                  "hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
              >
                {Icon && <Icon strokeWidth={1.5} className="size-[18px] shrink-0" />}
                <span className="flex-1 truncate">{group.label}</span>
                <ChevronDown
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={cn(
                    "size-3 shrink-0 transition-transform duration-[160ms] ease-out motion-reduce:transition-none",
                    expanded && "rotate-180"
                  )}
                />
              </button>

              {/* Hidden rather than merely unpainted: a link nobody can see is
                  a link nobody should reach with the Tab key either. */}
              <div hidden={!expanded} className="ms-[18px] space-y-0.5 py-1">
                {group.items.map((item) => (
                  <Child
                    key={item.key}
                    item={item}
                    active={active === item.key}
                    reachable={expanded}
                    onSelect={select}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
    </>
  );
}
