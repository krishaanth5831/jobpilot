// Distance between two canonical skills, and similarity between two fields
// of study. Both are pure lookups over the taxonomy — no I/O, no async.

import {
  FAMILIES,
  FIELD_BY_ID,
  SKILL_BY_ID,
  TAXONOMY_VERSION,
  skillLabel,
} from "./data";

export { TAXONOMY_VERSION, skillLabel };

/** 0 same skill · 1 direct parent/child or same family · 2 same broad domain ·
 *  Infinity unrelated. Used by the skill-quality table in score.ts. */
export type SkillDistance = 0 | 1 | 2 | typeof Infinity;

function domainOf(familyId: string): string | null {
  return FAMILIES[familyId]?.domain ?? null;
}

/**
 * Graph distance between two canonical skill ids.
 * Symmetric: `skillDistance(a, b) === skillDistance(b, a)` for all inputs.
 * An id that is not in the taxonomy is Infinity from everything except itself.
 */
export function skillDistance(a: string, b: string): SkillDistance {
  if (a === b) return 0;

  const left = SKILL_BY_ID.get(a);
  const right = SKILL_BY_ID.get(b);
  if (left === undefined || right === undefined) return Infinity;

  // Direct parent/child in either direction. `parentId` may cross families
  // (react -> javascript), which is exactly why this is checked before family.
  if (left.parentId === b || right.parentId === a) return 1;

  // Siblings under a shared parent are one hop apart through that parent.
  if (left.parentId !== null && left.parentId === right.parentId) return 1;

  if (left.familyId === right.familyId) return 1;

  const leftDomain = domainOf(left.familyId);
  const rightDomain = domainOf(right.familyId);
  if (leftDomain !== null && leftDomain === rightDomain) return 2;

  return Infinity;
}

/** 1.0 identical field · FIELD_FAMILY_SIMILARITY adjacent · 0 unrelated. */
export const FIELD_FAMILY_SIMILARITY = 0.5;

/**
 * Similarity between a candidate's field of study and a posting's preferred
 * field. Half credit for an adjacent discipline: an electrical engineering
 * degree against a computer engineering preference is a real partial match,
 * not a miss.
 */
export function fieldSimilarity(a: string | null, b: string | null): number {
  if (a === null || b === null) return 0;
  if (a === b) return 1;

  const left = FIELD_BY_ID.get(a);
  const right = FIELD_BY_ID.get(b);
  if (left === undefined || right === undefined) return 0;

  return left.familyId === right.familyId ? FIELD_FAMILY_SIMILARITY : 0;
}
