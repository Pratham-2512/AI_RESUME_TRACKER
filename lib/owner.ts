/**
 * Single-user mode: all data belongs to one owner.
 * The singleton profile row uses this fixed id (kept in sync with the migration).
 */
export const OWNER_ID =
  process.env.OWNER_ID ?? "00000000-0000-0000-0000-000000000001";
