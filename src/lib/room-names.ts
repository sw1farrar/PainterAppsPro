/**
 * Return a room/area name that doesn't collide with existing ones.
 * First "Bedroom" stays "Bedroom"; the next becomes "Bedroom 2", then "Bedroom 3", …
 */
export function uniqueRoomName(
  desired: string,
  existingNames: string[],
  excludeIndex?: number | null
): string {
  const base = desired.trim() || "Room";
  const occupied = new Set(
    existingNames
      .filter((_, i) => excludeIndex == null || i !== excludeIndex)
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean)
  );

  if (!occupied.has(base.toLowerCase())) return base;

  let n = 2;
  while (occupied.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}
