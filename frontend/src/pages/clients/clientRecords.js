/**
 * The client directory.
 *
 * One record per client, shared by the list and the detail page. They used to
 * hold separate arrays, which meant opening any client past the fifth showed an
 * empty form.
 *
 * Expiry dates are generated around today so the demo shows both expired and
 * still-valid records whenever it is run.
 */

const DAY = 24 * 60 * 60 * 1000;
export const dayOffset = (days) =>
  new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

export const clientRecords = [];

export const findClient = (id) =>
  clientRecords.find((c) => c.id === Number(id)) || null;

/** The clients that were folded into this one. */
export const mergedInto = (clients, client) =>
  client ? clients.filter((c) => c.mergedIntoClientNo === client.clientNo) : [];

/**
 * The name a client is known by once others have been merged into it.
 *
 * A case or an invoice raised under the old name has to stay findable under it,
 * so the old name travels with the new one rather than being replaced:
 *
 *   Bank Muscat - Ahli Bank Previously
 */
export function clientDisplayName(clients, client) {
  if (!client) return "";
  const absorbed = mergedInto(clients, client);
  if (absorbed.length === 0) return client.clientName;
  return (
    client.clientName +
    " — " +
    absorbed.map((c) => c.clientName).join(", ") +
    " Previously"
  );
}
