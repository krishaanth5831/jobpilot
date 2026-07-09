// Location handling for job sources. Two problems this solves:
// 1. Adzuna needs a country code in the URL path, so "Paris" must map to the
//    `fr` endpoint or every search hits the default country.
// 2. Boards without server-side location search (Greenhouse, Lever, Remotive)
//    need local filtering, including "Paris" matching a job listed as
//    "France" or "Remote (France)".
// Heuristic keyword table — covers the countries Adzuna supports plus their
// major cities. Unrecognized locations just fall through to substring match.

const COUNTRIES = [
  { code: "fr", name: "france", keywords: ["paris", "lyon", "marseille", "toulouse", "french"] },
  { code: "gb", name: "united kingdom", keywords: ["london", "manchester", "edinburgh", "glasgow", "uk", "england", "scotland", "wales", "britain"] },
  { code: "us", name: "united states", keywords: ["new york", "san francisco", "seattle", "austin", "boston", "chicago", "los angeles", "usa", "america"] },
  { code: "de", name: "germany", keywords: ["berlin", "munich", "hamburg", "frankfurt", "cologne", "german"] },
  { code: "es", name: "spain", keywords: ["madrid", "barcelona", "valencia", "sevilla"] },
  { code: "it", name: "italy", keywords: ["rome", "milan", "turin", "naples"] },
  { code: "nl", name: "netherlands", keywords: ["amsterdam", "rotterdam", "utrecht", "eindhoven", "holland", "dutch"] },
  { code: "ca", name: "canada", keywords: ["toronto", "vancouver", "montreal", "ottawa", "waterloo"] },
  { code: "au", name: "australia", keywords: ["sydney", "melbourne", "brisbane", "perth"] },
  { code: "in", name: "india", keywords: ["mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "pune", "chennai"] },
  { code: "ch", name: "switzerland", keywords: ["zurich", "geneva", "basel", "lausanne", "swiss"] },
  { code: "at", name: "austria", keywords: ["vienna", "graz", "linz"] },
  { code: "be", name: "belgium", keywords: ["brussels", "antwerp", "ghent"] },
  { code: "pl", name: "poland", keywords: ["warsaw", "krakow", "wroclaw", "gdansk"] },
  { code: "sg", name: "singapore", keywords: [] },
  { code: "nz", name: "new zealand", keywords: ["auckland", "wellington", "christchurch"] },
  { code: "mx", name: "mexico", keywords: ["mexico city", "guadalajara", "monterrey"] },
  { code: "br", name: "brazil", keywords: ["sao paulo", "são paulo", "rio de janeiro", "brasilia"] },
  { code: "za", name: "south africa", keywords: ["cape town", "johannesburg", "durban", "pretoria"] },
];

/** Map a free-text location ("Paris", "somewhere in France") to a country entry, or null. */
export function inferCountry(location) {
  const text = (location ?? "").toLowerCase();
  if (!text) return null;
  return (
    COUNTRIES.find(
      (c) => text.includes(c.name) || c.keywords.some((k) => text.includes(k))
    ) ?? null
  );
}

/**
 * Does a job's location text plausibly satisfy the location the user asked
 * for? Direct substring, worldwide-remote, or same-country all pass.
 */
export function matchesLocation(jobLocation, wanted) {
  if (!wanted?.trim()) return true;
  const hay = (jobLocation ?? "").toLowerCase();
  const want = wanted.toLowerCase().trim();

  if (hay.includes(want)) return true;
  if (/worldwide|anywhere|global/.test(hay)) return true;

  const country = inferCountry(want);
  if (!country) return false;
  return hay.includes(country.name) || country.keywords.some((k) => hay.includes(k));
}
