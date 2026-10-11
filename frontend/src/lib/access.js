import { CURRENT_USER } from "@/pages/dashboard/dashboardData";

/**
 * Whether the signed-in person holds a permission ("employees.create",
 * "circulars.edit") - the same list System Permissions sets and the API
 * enforces, delegated access included.
 *
 * It decides what is offered on screen, so nobody is shown a button the
 * server will refuse. It is not the check itself: the API makes that.
 */
export const can = (...keys) => {
  const granted = CURRENT_USER.permissions?.granted || [];
  return keys.some((key) => granted.includes(key));
};
