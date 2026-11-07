/** Legacy operations are deliberately retired, including calls from stale clients. */
export function rejectLegacyDatabaseOperation(): never {
  throw new Error("In-app database export, restore and arbitrary SQL are unavailable. Use your database owner's supported backup and administration tools.");
}
