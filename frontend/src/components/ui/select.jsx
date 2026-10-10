import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * More choices than fit in view without scrolling, and the list grows a
 * search box: nobody should scroll through two hundred countries to find one.
 */
const SEARCH_AFTER = 8;

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-[42px] w-full items-center justify-between whitespace-nowrap rounded-field border border-field-border bg-field px-3 py-2 text-sm transition-colors ring-offset-background placeholder:text-muted-foreground focus:border-[var(--focus-navy)] focus:shadow-[var(--focus-ring)] focus:outline-none disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-text aria-invalid:border-[var(--error-border)] [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUp className="h-4 w-4" />
    </SelectPrimitive.ScrollUpButton>
  )
);
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDown className="h-4 w-4" />
    </SelectPrimitive.ScrollDownButton>
  )
);
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

/** The words an option is found by: its own text, however it is wrapped. */
function textOf(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  return textOf(node.props?.children);
}

const isOption = (child) => React.isValidElement(child) && child.type === SelectItem;

/**
 * The options, with a search box above them once there are too many to see
 * at once.
 *
 * Mounted only while the list is open, so every opening starts with an empty
 * search. Options that do not match are hidden and disabled rather than
 * taken out: the box above shows the chosen value by reading its option, and
 * the arrow keys skip a disabled option, so the keyboard walks the matches
 * only.
 */
function SearchableOptions({ children, position, searchable, searchPlaceholder }) {
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef(null);
  const options = React.Children.toArray(children);
  const showSearch = searchable ?? options.filter(isOption).length > SEARCH_AFTER;

  // Radix puts the focus on the chosen option as the list opens; the search
  // takes it straight after, so typing starts the search.
  React.useEffect(() => {
    if (!showSearch) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [showSearch]);

  const term = query.trim().toLowerCase();
  const matchesTerm = (child) =>
    !term || textOf(child.props.children).toLowerCase().includes(term);
  const matches = options.filter((child) => isOption(child) && matchesTerm(child)).length;
  const shown = options.map((child) =>
    !isOption(child) || matchesTerm(child)
      ? child
      : React.cloneElement(child, {
          disabled: true,
          className: cn(child.props.className, "hidden"),
        })
  );

  return (
    <>
      {showSearch && (
        <div className="relative border-b border-container-border p-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Typing belongs to the search, not to the list's own
            // jump-to-letter; only the keys that move into the list or
            // close it are let through.
            onKeyDown={(e) => {
              if (!["ArrowDown", "ArrowUp", "Escape", "Tab"].includes(e.key)) {
                e.stopPropagation();
              }
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 w-full rounded-sm bg-transparent ps-8 pe-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}
      <SelectScrollUpButton />
      {/* The list is as tall as it needs to be, up to the max-h on the
          content around it. It must not be pinned to the height of the
          trigger: that leaves one row showing and everything else behind a
          scroll button, which reads as an empty dropdown. */}
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {shown}
        {term && matches === 0 && (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">No matches</p>
        )}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </>
  );
}

const SelectContent = React.forwardRef(
  (
    {
      className,
      children,
      position = "popper",
      // Forces the search on or off; left out, it follows the option count.
      searchable,
      searchPlaceholder = "Search...",
      ...props
    },
    ref
  ) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 flex max-h-96 min-w-[8rem] flex-col overflow-hidden rounded-[8px] border-container-border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-end-2 data-[side=right]:slide-in-from-start-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        <SearchableOptions
          position={position}
          searchable={searchable}
          searchPlaceholder={searchPlaceholder}
        >
          {children}
        </SearchableOptions>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 ps-2 pe-8 text-sm outline-none focus:bg-menu-hover focus:text-primary data-[state=checked]:bg-menu-selected data-[state=checked]:text-menu-selected-ink data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute end-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
);
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
