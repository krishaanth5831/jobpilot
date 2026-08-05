// Typed access to the taxonomy JSON. Single place the raw files are read, so
// resolve.ts and graph.ts can never disagree about their shape.

import skillsJson from "./skills.json";
import fieldsJson from "./fields.json";

export interface SkillEntry {
  id: string;
  label: string;
  aliases: string[];
  parentId: string | null;
  familyId: string;
}

export interface FamilyEntry {
  label: string;
  /** Broad discipline. Two skills in different families but the same domain
   *  are `skillDistance` 2. */
  domain: string;
}

export interface FieldEntry {
  id: string;
  label: string;
  aliases: string[];
  familyId: string;
}

/** Bumped whenever skills.json or fields.json changes in a way that could move
 *  a score. Persisted alongside results so old scores stay explainable. */
export const TAXONOMY_VERSION: string = skillsJson.version;

export const SKILLS: readonly SkillEntry[] = skillsJson.skills as SkillEntry[];

export const FAMILIES: Readonly<Record<string, FamilyEntry>> =
  skillsJson.families as Record<string, FamilyEntry>;

export const FIELDS: readonly FieldEntry[] = fieldsJson.fields as FieldEntry[];

/** id -> entry, for O(1) lookup from a canonical id. */
export const SKILL_BY_ID: ReadonlyMap<string, SkillEntry> = new Map(
  SKILLS.map((s) => [s.id, s]),
);

export const FIELD_BY_ID: ReadonlyMap<string, FieldEntry> = new Map(
  FIELDS.map((f) => [f.id, f]),
);

/** Human-readable label for a canonical id, falling back to the id itself so
 *  an unknown id still renders something in `topGaps`. */
export function skillLabel(canonicalId: string): string {
  return SKILL_BY_ID.get(canonicalId)?.label ?? canonicalId;
}
