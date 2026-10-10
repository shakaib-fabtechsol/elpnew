import { Link, useLocation } from "react-router-dom";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import { signOut } from "@/lib/api/session";
import {
  ChevronDown,
  Clock,
  Settings,
  LogOut,
  KeyRound,
  UserCircle,
  Menu,
  SlidersHorizontal,
} from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
  NavigationMenuTrigger,
  NavigationMenuContent,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useFirm } from "@/lib/firm/context";
import { useLanguage, LANGUAGES } from "@/lib/language/context";
import { navSections } from "@/lib/navigation";
import NotificationBell from "./NotificationBell";
import logo from "@/assets/logonew.jpeg";

/** The firm's mark. Height is set; the width follows the artwork. */
function Logo({ name, className }) {
  return (
    <img
      src={logo}
      alt={name}
      className={cn("h-[60px] w-[190px] shrink-0 object-contain", className)}
    />
  );
}

/**
 * Header navigation.
 *
 * An entry with `items` is a section that opens as a menu; one with `path` is a
 * plain link. Further pages for Administration go in its `items` array - nothing
 * else has to change.
 */
/**
 * The person signed in, and what their own menu offers.
 *
 * Kept apart from `navSections` on purpose: these belong to the reader, not
 * to the firm's records, and they do not change with whichever employee
 * record happens to be on screen.
 */
// Whoever signed in (filled by lib/api/session.js on sign-in).
const signedInName = () => CURRENT_USER.name || "";

/** First letter of the first name and of the last, for the avatar. */
function initials(name) {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] || "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const ACCOUNT_LINKS = [
  { label: "My Profile", path: "/my-profile", icon: UserCircle },
  { label: "Change Password", path: "/settings/password", icon: KeyRound },
  // The signed-in user's own working record: My Profile, on its Daily
  // Activities section.
  { label: "Activity Review", path: "/my-profile", state: { section: "daily" }, icon: Clock },
  { label: "Settings", path: "/settings/firm", icon: Settings },
  { label: "System Settings", path: "/settings/system", icon: SlidersHorizontal },
];


export default function Header({ onNavClick, activeNav }) {
  const location = useLocation();
  const { firmInfo } = useFirm();
  const { language, setLanguage } = useLanguage();

  const isActive = (key) => {
    return activeNav === key || location.pathname.startsWith(`/${key}`);
  };

  // A section highlights when any page inside it is open.
  const isSectionActive = (section) =>
    section.items
      ? section.items.some((item) => isActive(item.key))
      : isActive(section.key);

  return (
    <header className="fixed top-0 start-0 end-0 z-50 border-b border-container-border bg-card">
      <div className="flex h-[72px] items-center px-4 md:px-7">
        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden me-2">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>
                <Logo name={firmInfo.nameEn} />
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col p-2">
              {navSections.map((section) =>
                section.items ? (
                  <div key={section.key} className="mt-2">
                    <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.name}
                    </p>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.key}
                          to={item.path}
                          onClick={() => onNavClick && onNavClick(item.key)}
                          className={cn(
                            "flex items-center mt-1 gap-3 px-4 py-3 rounded-md text-nowrap text-sm font-medium transition-colors",
                            isActive(item.key)
                              ? "bg-primary text-primary-foreground"
                              : "text-primary hover:bg-secondary"
                          )}
                        >
                          {Icon && <Icon className="h-4 w-4 shrink-0" />}
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <Link
                    key={section.key}
                    to={section.path}
                    onClick={() => onNavClick && onNavClick(section.key)}
                    className={cn(
                      "flex items-center mt-1 gap-3 px-4 py-3 rounded-md text-nowrap text-sm font-medium transition-colors",
                      isActive(section.key)
                        ? "bg-primary text-primary-foreground"
                        : "text-primary hover:bg-secondary"
                    )}
                  >
                    {section.icon && (
                      <section.icon className="h-4 w-4 shrink-0" />
                    )}
                    {section.name}
                  </Link>
                )
              )}
              <Separator className="my-4" />
              <Link
                to="/settings/password"
                className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors"
              >
                <KeyRound className="h-4 w-4" />
                Change Password
              </Link>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link to="/" className="flex items-center">
          <Logo name={firmInfo.nameEn} />
        </Link>

        {/* Desktop Navigation - left aligned, next to logo */}
        <NavigationMenu className="hidden lg:flex ms-[22px]" viewport={false}>
          <NavigationMenuList className="gap-1">
            {navSections.map((section) => {
              const active = isSectionActive(section);

              // A plain link
              if (!section.items) {
                return (
                  <NavigationMenuItem key={section.key}>
                    {/* One link, not two. NavigationMenuLink draws an <a> of
                        its own, so wrapping it in the router's Link put an
                        anchor inside an anchor - invalid HTML, and two
                        targets for one click. `asChild` hands the menu's
                        styling and keyboard handling to the router's link
                        instead, the way the dropdown items below already do. */}
                    <NavigationMenuLink
                      asChild
                      className={cn(
                        "inline-flex h-auto items-center gap-2 text-nowrap rounded-md px-2.5 py-[11px] text-[15px]/[20px] font-normal transition-colors",
                        "text-primary hover:bg-menu-hover",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        // Marked by the fill it takes, not by a rule under
                        // it: the same pale ground a hovered control takes,
                        // held while the page it leads to is the one open.
                        active
                          ? "bg-menu-selected font-bold text-primary"
                          : "text-primary"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Link
                        to={section.path}
                        onClick={() => onNavClick && onNavClick(section.key)}
                      >
                        <span>{section.name}</span>
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              }

              // A section that opens as a menu
              return (
                <NavigationMenuItem key={section.key}>
                  {/* 14px, and half a weight heavier while it is the one
                      that is open - one header item at a time. */}
                  <NavigationMenuTrigger
                    className={cn(
                      "inline-flex h-auto items-center gap-2 text-nowrap rounded-md px-2.5 py-[11px] text-[15px]/[20px] font-normal transition-colors",
                      "bg-card text-primary hover:bg-menu-hover",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      // Open, it takes the same pale fill a hovered control
                      // takes - the panel below it is what says it is open.
                      "data-[state=open]:bg-menu-hover data-[state=open]:text-primary",
                      active && "bg-menu-selected font-bold"
                    )}
                  >
                    {section.name}
                  </NavigationMenuTrigger>
                  {/* 270px wide, inset 8px, cornered at 10px: the one
                      geometry every menu in the system is drawn to. */}
                  <NavigationMenuContent>
                    <ul className="w-[270px] rounded-container p-2">
                      {section.items.map((item) => (
                        <li key={item.key}>
                          <NavigationMenuLink
                            asChild
                            className={cn(
                              // The rule runs down the item's logical start,
                              // so it swaps sides with the language rather
                              // than staying on the left in Arabic.
                              // 46px of row, cornered at 6px, with the rule
                              // down its logical start so it swaps sides
                              // with the language rather than staying left
                              // in Arabic.
                              "flex h-[46px] items-center gap-2.5 rounded-[6px] border-s-[3px] border-transparent px-2.5 transition-colors",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              isActive(item.key)
                                ? "border-s-primary bg-menu-hover font-semibold text-primary"
                                : "text-primary hover:bg-menu-hover hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-field-border focus:bg-menu-hover"
                            )}
                          >
                            <Link
                              to={item.path}
                              aria-current={isActive(item.key) ? "page" : undefined}
                              onClick={() => onNavClick && onNavClick(item.key)}
                            >
                              {/* Named colour on purpose: without a text-
                                  class the menu greys every icon it holds. */}
                              {/* Navy on the selected item and grey on the
                                  rest: with the block gone, the icon is half
                                  of what says which one is open. */}
                              <item.icon
                                strokeWidth={1.5}
                                className={cn(
                                  "size-[18px] shrink-0",
                                  isActive(item.key)
                                    ? "text-primary"
                                    : "text-menu-icon"
                                )}
                              />
                              {/* The destination, and nothing under it. A
                                  line of explanation beneath each name made
                                  the panel a page of its own; the names are
                                  what somebody came to the menu to pick. */}
                              <span
                                className={cn(
                                  "truncate text-[16px]/[20px]",
                                  isActive(item.key) ? "font-semibold" : "font-medium"
                                )}
                              >
                                {item.name}
                              </span>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              );
            })}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Spacer - push user to right */}
        <div className="flex-1" />

        {/* Papers running out. Before the language switch, because it is
            the one thing here that asks for something to be done. */}
        <NotificationBell />

        {/* The account menu.
            The name and every action in here belong to the person signed in.
            They do not change with whichever employee record is on screen. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* One button, not a row of them: the avatar, the name and the
                chevron are all the same target. */}
            <button
              type="button"
              className={cn(
                "ms-2 flex h-[50px] items-center gap-[10px] rounded-md px-2.5 transition-colors",
                "bg-card hover:bg-menu-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "data-[state=open]:bg-menu-hover",
                "group"
              )}
            >
              {/* Fixed fill on purpose: the avatar stands for one person, so
                  it keeps its colour whatever the page around it is doing. */}
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#DCE6EB] text-[12px]/[1] font-semibold text-primary">
                {initials(signedInName() || "?")}
              </span>
              <span className="hidden text-[14px]/[20px] font-semibold text-primary sm:inline-block">
                {signedInName()}
              </span>
              <ChevronDown
                strokeWidth={1.5}
                aria-hidden="true"
                className="size-3 shrink-0 text-primary transition-transform duration-[160ms] ease-out group-data-[state=open]:rotate-180 motion-reduce:transition-none"
              />
            </button>
          </DropdownMenuTrigger>

          {/* 270px, 8px of padding, cornered at 10px and ended against the
              trigger - the one panel geometry the header is drawn to. */}
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="w-[270px] rounded-container border border-container-border bg-card p-2 shadow-md"
          >
            {ACCOUNT_LINKS.map((item) => (
              <DropdownMenuItem key={item.label} asChild className="p-0 focus:bg-transparent">
                <Link
                  to={item.path}
                  state={item.state}
                  className="flex h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 text-[15px]/[20px] font-semibold text-primary transition-colors hover:bg-menu-hover focus:bg-menu-hover"
                >
                  <item.icon strokeWidth={1.5} className="size-[18px] shrink-0 text-menu-icon" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator className="my-[10px] bg-container-border" />

            {/* Both languages stay on screen with the current one marked,
                rather than one button that swaps what it says. */}
            <DropdownMenuLabel className="px-2.5 py-0 pb-1.5 text-[13px]/[18px] font-semibold uppercase tracking-wide text-muted-foreground">
              Language
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
              {LANGUAGES.map((option) => (
                <DropdownMenuRadioItem
                  key={option.code}
                  value={option.code}
                  className="h-[44px] cursor-pointer rounded-[6px] pe-2.5 text-[15px]/[20px] font-medium text-primary transition-colors hover:bg-menu-hover focus:bg-menu-hover"
                >
                  {/* The ring is always drawn; the dot above it is what the
                      indicator fills in once this is the chosen language. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute start-2 size-3.5 rounded-full border border-field-border"
                  />
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator className="my-[10px] bg-container-border" />

            {/* Navy like every other row: signing out is the way out, not a
                destructive act that needs a warning colour. */}
            <DropdownMenuItem
              onClick={() => signOut()}
              className="flex h-[44px] cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 text-[15px]/[20px] font-semibold text-primary transition-colors hover:bg-menu-hover focus:bg-menu-hover"
            >
              <LogOut strokeWidth={1.5} className="size-[18px] shrink-0 text-menu-icon" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
