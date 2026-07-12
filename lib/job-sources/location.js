// Location handling for job sources. Three problems this solves:
// 1. Adzuna needs a country code in the URL path, so "Paris" must map to
//    the `fr` endpoint (JSearch takes the same code as a param).
// 2. Boards without server-side location search need local filtering.
// 3. Matching must be strict enough not to produce "random places": a
//    search for Toronto must NOT accept Vancouver (sibling city), but a
//    country-scoped listing like "Remote, Canada" must pass, and searching
//    a whole country ("Germany") accepts any of its cities.

// Lowercase + strip accents so "Zürich" matches "zurich".
const strip = (text) =>
  (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// The countries Adzuna supports, with the names they go by and their major
// cities/regions. Keywords infer the country from a city; names detect
// country-scoped listings. Never put bare 2-letter codes in names — "us"
// substring-matches "Austria".
const COUNTRIES = [
  { code: "fr", names: ["france", "french"], keywords: ["paris", "lyon", "marseille", "toulouse", "bordeaux", "lille", "nantes", "nice", "strasbourg", "ile-de-france"] },
  { code: "gb", names: ["united kingdom", "uk", "britain", "england", "scotland", "wales"], keywords: ["london", "manchester", "edinburgh", "glasgow", "birmingham", "leeds", "bristol", "cambridge", "oxford", "belfast", "cardiff"] },
  { code: "us", names: ["united states", "usa", "u.s.", "america"], keywords: ["new york", "san francisco", "seattle", "austin", "boston", "chicago", "los angeles", "denver", "atlanta", "miami", "dallas", "houston", "san jose", "san diego", "portland", "philadelphia", "washington dc", "phoenix", "minneapolis", "salt lake", "raleigh", "pittsburgh", "detroit", "nashville", "california", "texas", "florida", "virginia", "colorado", "georgia", "illinois", "massachusetts", "michigan", "ohio", "oregon", "utah", "arizona", "north carolina", "new jersey", "pennsylvania", "tennessee", "nevada", "maryland", "minnesota", "missouri", "indiana", "wisconsin"] },
  { code: "de", names: ["germany", "deutschland", "german"], keywords: ["berlin", "munich", "muenchen", "hamburg", "frankfurt", "cologne", "koln", "stuttgart", "dusseldorf", "leipzig", "dresden", "bavaria"] },
  { code: "es", names: ["spain", "espana", "spanish"], keywords: ["madrid", "barcelona", "valencia", "sevilla", "seville", "malaga", "bilbao"] },
  { code: "it", names: ["italy", "italia", "italian"], keywords: ["rome", "roma", "milan", "milano", "turin", "torino", "naples", "napoli", "bologna", "florence"] },
  { code: "nl", names: ["netherlands", "holland", "dutch"], keywords: ["amsterdam", "rotterdam", "utrecht", "eindhoven", "the hague", "den haag", "delft"] },
  { code: "ca", names: ["canada", "canadian"], keywords: ["toronto", "vancouver", "montreal", "ottawa", "waterloo", "calgary", "edmonton", "mississauga", "winnipeg", "halifax", "ontario", "british columbia", "alberta", "quebec"] },
  { code: "au", names: ["australia", "australian"], keywords: ["sydney", "melbourne", "brisbane", "perth", "adelaide", "canberra"] },
  { code: "in", names: ["india", "indian"], keywords: ["mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "pune", "chennai", "gurgaon", "gurugram", "noida", "kolkata", "ahmedabad"] },
  { code: "ch", names: ["switzerland", "swiss"], keywords: ["zurich", "geneva", "geneve", "basel", "lausanne", "bern", "zug"] },
  { code: "at", names: ["austria", "austrian"], keywords: ["vienna", "wien", "graz", "linz", "salzburg"] },
  { code: "be", names: ["belgium", "belgian"], keywords: ["brussels", "bruxelles", "antwerp", "antwerpen", "ghent", "gent", "leuven"] },
  { code: "pl", names: ["poland", "polish"], keywords: ["warsaw", "warszawa", "krakow", "cracow", "wroclaw", "gdansk", "poznan"] },
  { code: "sg", names: ["singapore"], keywords: [] },
  { code: "nz", names: ["new zealand"], keywords: ["auckland", "wellington", "christchurch"] },
  { code: "mx", names: ["mexico", "mexican"], keywords: ["mexico city", "cdmx", "guadalajara", "monterrey"] },
  { code: "br", names: ["brazil", "brasil", "brazilian"], keywords: ["sao paulo", "rio de janeiro", "brasilia", "belo horizonte", "campinas", "curitiba", "porto alegre"] },
  { code: "za", names: ["south africa"], keywords: ["cape town", "johannesburg", "durban", "pretoria"] },
];

/** Map a free-text location ("Paris", "somewhere in France") to a country entry, or null. */
export function inferCountry(location) {
  const text = strip(location);
  if (!text) return null;
  return (
    COUNTRIES.find(
      (c) => c.names.some((n) => text.includes(n)) || c.keywords.some((k) => text.includes(k))
    ) ?? null
  );
}

/** Full country name for a 2-letter code ("US" → "united states"), or null. */
export function countryName(code) {
  const entry = COUNTRIES.find((c) => c.code === strip(code));
  return entry ? entry.names[0] : null;
}

/**
 * Does a job's location text satisfy the location the user asked for?
 * Passes: direct text match, worldwide-remote, a country-scoped listing
 * ("Remote, France" for "Paris"), or — only when the user asked for a
 * whole country — any city in it. Sibling cities do NOT pass: searching
 * Toronto never accepts Vancouver.
 */
export function matchesLocation(jobLocation, wanted) {
  if (!wanted?.trim()) return true;
  const hay = strip(jobLocation);
  const want = strip(wanted).trim();
  // A job with no usable location can't satisfy an explicit location filter.
  if (!hay || hay === "unknown") return false;

  if (hay.includes(want)) return true;
  if (/worldwide|anywhere|global|international/.test(hay)) return true;

  // "Paris, France" typed by the user → the token "paris" matching is enough.
  const tokens = want.split(/[,/]|\s+/).filter((t) => t.length >= 5);
  if (tokens.some((t) => hay.includes(t))) return true;

  const country = inferCountry(want);
  if (!country) return false;

  // Country-scoped listings satisfy any place inside that country — but
  // only genuinely country-scoped ones: remote-in-country or a bare
  // country name. "Burnaby, BC, Canada" merely spells out its country and
  // must NOT pass a Toronto search.
  if (country.names.some((n) => hay.includes(n))) {
    if (hay.includes("remote")) return true;
    if (country.names.some((n) => hay.trim() === n)) return true;
  }

  // Only a whole-country search accepts that country's cities.
  const wantIsCountry = country.names.some((n) => want.includes(n));
  return wantIsCountry && country.keywords.some((k) => hay.includes(k));
}
