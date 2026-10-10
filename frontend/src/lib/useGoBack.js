import { useNavigate, useLocation } from "react-router-dom";

/**
 * The way back from a page that was opened on top of another one.
 *
 * It steps back through history rather than jumping to a fixed page, because
 * the page somebody came from is not always the list: a supplier can be opened
 * from the suppliers list, from an invoice, or from a search, and sending them
 * to the list from all three loses their place in two of them.
 *
 * `fallback` is used only when there is nowhere to go back to - a page reached
 * from a pasted link or a bookmark has no history behind it, and a back button
 * that did nothing would be worse than one that goes somewhere sensible.
 *
 * Nothing here depends on anything having been saved, so it works just as well
 * on a form somebody opened and then thought better of.
 */
export function useGoBack(fallback = "/dashboard") {
  const navigate = useNavigate();
  const location = useLocation();

  // React Router stamps "default" on the first entry of a session, which is how
  // a page reached directly is told apart from one reached by navigating.
  const canGoBack = location.key !== "default";

  return () => {
    if (canGoBack) navigate(-1);
    else navigate(fallback);
  };
}
