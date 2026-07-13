// Location handling for job search. Design principles, learned the hard way:
//
// 1. The job APIs are per-country. If we ask for `fr`, every result is
//    already in France — so TRUST that scoping and don't delete jobs just
//    because their city ("Grenoble, Isère") isn't in some list.
// 2. JSearch returns far more when the place is in the QUERY TEXT ("engineer
//    in portugal") than from the country param alone — so we always pass the
//    place as a hint, not just a code.
// 3. Every country must resolve to its ISO code, so the table below is the
//    full world, not a handful of countries. Adzuna only covers ~19 of them;
//    for the rest JSearch carries the search alone.
//
// Flow: resolve what the user typed into a scope (continent / country / city
// / unknown), decide which country code(s) to query, then keep every result
// whose country belongs to that scope (a city scope also requires the city).

export const strip = (text) =>
  (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Whole-word test so "eu" doesn't match "eugene" and "us" doesn't match
// "houston".
const hasWord = (hay, word) =>
  new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(hay);

// code -> [continent, canonical name, ...aliases]. Continents: europe,
// north america, south america, asia, africa, oceania. Every sovereign
// country is here so any of them resolves; aliases cover the common ways
// people type the big ones.
const COUNTRIES_RAW = {
  // North America
  us: ["north america", "united states", "usa", "u.s.", "u.s.a", "america", "american"],
  ca: ["north america", "canada", "canadian"],
  mx: ["north america", "mexico", "mexican"],
  gt: ["north america", "guatemala"], cr: ["north america", "costa rica"], pa: ["north america", "panama"],
  do: ["north america", "dominican republic"], cu: ["north america", "cuba"], jm: ["north america", "jamaica"],
  hn: ["north america", "honduras"], sv: ["north america", "el salvador"], ni: ["north america", "nicaragua"],
  tt: ["north america", "trinidad and tobago"], bs: ["north america", "bahamas"], bz: ["north america", "belize"],
  // South America
  br: ["south america", "brazil", "brasil", "brazilian"],
  ar: ["south america", "argentina"], cl: ["south america", "chile"], co: ["south america", "colombia"],
  pe: ["south america", "peru"], uy: ["south america", "uruguay"], ec: ["south america", "ecuador"],
  bo: ["south america", "bolivia"], py: ["south america", "paraguay"], ve: ["south america", "venezuela"],
  // Europe
  gb: ["europe", "united kingdom", "uk", "britain", "great britain", "england", "scotland", "wales", "northern ireland"],
  ie: ["europe", "ireland", "irish"], fr: ["europe", "france", "french"],
  de: ["europe", "germany", "deutschland", "german"], nl: ["europe", "netherlands", "holland", "the netherlands", "dutch"],
  be: ["europe", "belgium", "belgian"], lu: ["europe", "luxembourg"], es: ["europe", "spain", "espana", "spanish"],
  pt: ["europe", "portugal", "portuguese"], it: ["europe", "italy", "italia", "italian"],
  ch: ["europe", "switzerland", "swiss"], at: ["europe", "austria", "austrian"],
  se: ["europe", "sweden", "swedish"], no: ["europe", "norway", "norwegian"], dk: ["europe", "denmark", "danish"],
  fi: ["europe", "finland", "finnish"], is: ["europe", "iceland"], pl: ["europe", "poland", "polish"],
  cz: ["europe", "czech republic", "czechia"], sk: ["europe", "slovakia"], hu: ["europe", "hungary"],
  ro: ["europe", "romania"], bg: ["europe", "bulgaria"], gr: ["europe", "greece", "greek"],
  hr: ["europe", "croatia"], si: ["europe", "slovenia"], rs: ["europe", "serbia"], ua: ["europe", "ukraine"],
  ee: ["europe", "estonia"], lv: ["europe", "latvia"], lt: ["europe", "lithuania"], mt: ["europe", "malta"],
  cy: ["europe", "cyprus"], al: ["europe", "albania"], ba: ["europe", "bosnia and herzegovina", "bosnia"],
  mk: ["europe", "north macedonia", "macedonia"], me: ["europe", "montenegro"], md: ["europe", "moldova"],
  by: ["europe", "belarus"], ru: ["europe", "russia", "russian federation"],
  // Asia
  in: ["asia", "india", "indian"], sg: ["asia", "singapore"], cn: ["asia", "china", "chinese"],
  jp: ["asia", "japan", "japanese"], kr: ["asia", "south korea", "korea", "republic of korea"],
  hk: ["asia", "hong kong"], tw: ["asia", "taiwan"], my: ["asia", "malaysia"], id: ["asia", "indonesia"],
  ph: ["asia", "philippines"], th: ["asia", "thailand"], vn: ["asia", "vietnam"], pk: ["asia", "pakistan"],
  bd: ["asia", "bangladesh"], lk: ["asia", "sri lanka"], np: ["asia", "nepal"], kz: ["asia", "kazakhstan"],
  ae: ["asia", "united arab emirates", "uae", "emirates"], sa: ["asia", "saudi arabia", "saudi"],
  il: ["asia", "israel"], tr: ["asia", "turkey", "turkiye"], qa: ["asia", "qatar"], kw: ["asia", "kuwait"],
  bh: ["asia", "bahrain"], om: ["asia", "oman"], jo: ["asia", "jordan"], lb: ["asia", "lebanon"], ge: ["asia", "georgia (country)"],
  // Africa
  za: ["africa", "south africa"], ng: ["africa", "nigeria"], eg: ["africa", "egypt"], ke: ["africa", "kenya"],
  ma: ["africa", "morocco"], gh: ["africa", "ghana"], tn: ["africa", "tunisia"], et: ["africa", "ethiopia"],
  tz: ["africa", "tanzania"], ug: ["africa", "uganda"], dz: ["africa", "algeria"], ci: ["africa", "ivory coast", "cote divoire"],
  sn: ["africa", "senegal"], rw: ["africa", "rwanda"], mu: ["africa", "mauritius"], zm: ["africa", "zambia"], zw: ["africa", "zimbabwe"],
  // Oceania
  au: ["oceania", "australia", "australian"], nz: ["oceania", "new zealand"], fj: ["oceania", "fiji"],
};

// Major cities/regions -> country code, so a city search scopes to the right
// country. Not exhaustive (there are thousands of cities); an unlisted city
// falls back to JSearch's own geocoding of the query text.
const CITY_TO_CODE = {
  // United States
  "new york": "us", "san francisco": "us", "seattle": "us", "austin": "us", "boston": "us", "chicago": "us",
  "los angeles": "us", "denver": "us", "atlanta": "us", "miami": "us", "dallas": "us", "houston": "us",
  "san jose": "us", "san diego": "us", "portland": "us", "philadelphia": "us", "washington": "us",
  "phoenix": "us", "minneapolis": "us", "raleigh": "us", "pittsburgh": "us", "detroit": "us", "nashville": "us",
  california: "us", texas: "us", florida: "us", virginia: "us", colorado: "us", massachusetts: "us", "new jersey": "us",
  // Canada
  toronto: "ca", vancouver: "ca", montreal: "ca", ottawa: "ca", waterloo: "ca", calgary: "ca", edmonton: "ca",
  mississauga: "ca", winnipeg: "ca", halifax: "ca", ontario: "ca", "british columbia": "ca", alberta: "ca", quebec: "ca",
  // United Kingdom / Ireland
  london: "gb", manchester: "gb", edinburgh: "gb", glasgow: "gb", birmingham: "gb", leeds: "gb", bristol: "gb",
  cambridge: "gb", oxford: "gb", belfast: "gb", cardiff: "gb", liverpool: "gb", sheffield: "gb", nottingham: "gb",
  dublin: "ie", cork: "ie", galway: "ie",
  // France
  paris: "fr", lyon: "fr", marseille: "fr", toulouse: "fr", bordeaux: "fr", lille: "fr", nantes: "fr",
  nice: "fr", strasbourg: "fr", grenoble: "fr", montpellier: "fr", rennes: "fr", "ile-de-france": "fr",
  // Germany
  berlin: "de", munich: "de", muenchen: "de", munchen: "de", hamburg: "de", frankfurt: "de", cologne: "de",
  koln: "de", stuttgart: "de", dusseldorf: "de", leipzig: "de", dresden: "de", nuremberg: "de", hannover: "de",
  // Netherlands / Belgium
  amsterdam: "nl", rotterdam: "nl", utrecht: "nl", eindhoven: "nl", "the hague": "nl", "den haag": "nl", delft: "nl",
  groningen: "nl", haarlem: "nl", "noord-holland": "nl", "zuid-holland": "nl", "noord-brabant": "nl",
  brussels: "be", antwerp: "be", ghent: "be", leuven: "be",
  // Iberia / Italy
  madrid: "es", barcelona: "es", valencia: "es", sevilla: "es", seville: "es", malaga: "es", bilbao: "es",
  lisbon: "pt", lisboa: "pt", porto: "pt",
  rome: "it", roma: "it", milan: "it", milano: "it", turin: "it", naples: "it", bologna: "it", florence: "it",
  // Nordics / Central Europe
  stockholm: "se", gothenburg: "se", malmo: "se", oslo: "no", copenhagen: "dk", helsinki: "fi",
  zurich: "ch", geneva: "ch", basel: "ch", lausanne: "ch", bern: "ch",
  vienna: "at", warsaw: "pl", krakow: "pl", wroclaw: "pl", prague: "cz", budapest: "hu", athens: "gr", bucharest: "ro",
  // Asia / Middle East
  mumbai: "in", delhi: "in", bangalore: "in", bengaluru: "in", hyderabad: "in", pune: "in", chennai: "in",
  gurgaon: "in", gurugram: "in", noida: "in", kolkata: "in", ahmedabad: "in",
  singapore: "sg", "hong kong": "hk", tokyo: "jp", osaka: "jp", kyoto: "jp", seoul: "kr", taipei: "tw",
  "kuala lumpur": "my", jakarta: "id", manila: "ph", bangkok: "th", "ho chi minh": "vn", hanoi: "vn",
  dubai: "ae", "abu dhabi": "ae", riyadh: "sa", "tel aviv": "il", istanbul: "tr", ankara: "tr", doha: "qa",
  // Africa / Oceania / LatAm
  "cape town": "za", johannesburg: "za", durban: "za", pretoria: "za", lagos: "ng", nairobi: "ke", cairo: "eg",
  casablanca: "ma", accra: "gh",
  sydney: "au", melbourne: "au", brisbane: "au", perth: "au", adelaide: "au", canberra: "au",
  auckland: "nz", wellington: "nz", christchurch: "nz",
  "sao paulo": "br", "rio de janeiro": "br", brasilia: "br", "buenos aires": "ar", santiago: "cl",
  bogota: "co", lima: "pe", "mexico city": "mx", cdmx: "mx", guadalajara: "mx", monterrey: "mx",
};

// Build lookup structures.
const COUNTRIES = Object.entries(COUNTRIES_RAW).map(([code, [continent, ...names]]) => ({ code, continent, names }));
const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));
const CITY_NAMES = Object.keys(CITY_TO_CODE);

// Continent -> member codes (derived), plus the strong markets we actually
// query (kept small so a continent search doesn't fan out endlessly). A few
// named regions ride the same machinery.
const membersOf = (continent) => COUNTRIES.filter((c) => c.continent === continent).map((c) => c.code);
const REGIONS = {
  europe: { members: membersOf("europe"), primary: ["gb", "de", "fr"] },
  "north america": { members: membersOf("north america"), primary: ["us", "ca"] },
  "south america": { members: membersOf("south america"), primary: ["br"] },
  americas: { members: [...membersOf("north america"), ...membersOf("south america")], primary: ["us", "ca", "br"] },
  asia: { members: membersOf("asia"), primary: ["in", "sg"] },
  oceania: { members: membersOf("oceania"), primary: ["au", "nz"] },
  africa: { members: membersOf("africa"), primary: ["za"] },
  "middle east": { members: ["ae", "sa", "il", "tr", "qa", "kw", "bh", "om", "jo", "lb"], primary: ["ae"] },
};

// Phrases that name a region (longer/more specific first).
const REGION_ALIASES = [
  ["north america", "north america"], ["south america", "south america"], ["latin america", "south america"],
  ["the americas", "americas"], ["americas", "americas"],
  ["middle east", "middle east"],
  ["europe", "europe"], ["european", "europe"], ["eu", "europe"],
  ["asia", "asia"], ["apac", "asia"],
  ["oceania", "oceania"], ["australasia", "oceania"],
  ["africa", "africa"],
];

// Adzuna's per-country endpoints (everything else is JSearch-only).
export const ADZUNA_COUNTRIES = new Set(["at", "au", "be", "br", "ca", "ch", "de", "es", "fr", "gb", "in", "it", "mx", "nl", "nz", "pl", "sg", "us", "za"]);
export const isAdzunaCountry = (code) => ADZUNA_COUNTRIES.has(code);

/** Full country name for a 2-letter code ("US" → "united states"), or null. */
export function countryName(code) {
  const entry = byCode.get(strip(code));
  return entry ? entry.names[0] : null;
}

// The country whose name best (longest) matches the text, or null.
function countryByName(hay) {
  let best = null;
  for (const c of COUNTRIES) {
    for (const n of c.names) {
      if (hasWord(hay, n) && (!best || n.length > best.len)) best = { code: c.code, len: n.length };
    }
  }
  return best?.code ?? null;
}

/** The country code a job location belongs to, or null if undeterminable. */
export function countryOfLocation(location) {
  const hay = strip(location);
  if (!hay || hay === "unknown") return null;
  const named = countryByName(hay);
  if (named) return named;
  // Trailing 2-letter code token, e.g. "Paris, FR".
  const tokens = hay.split(/[^a-z]+/).filter(Boolean);
  const last = tokens[tokens.length - 1];
  if (last && last.length === 2 && byCode.has(last)) return last;
  // A recognizable city pins the country.
  for (const [city, code] of Object.entries(CITY_TO_CODE)) {
    if (hay.includes(city)) return code;
  }
  return null;
}

function matchRegion(hay) {
  for (const [alias, key] of REGION_ALIASES) {
    if (hasWord(hay, alias)) return key;
  }
  return null;
}

/**
 * Turn what the user typed into a search scope:
 *   kind        "any" | "continent" | "country" | "city" | "unknown"
 *   queryCodes  country codes to query ([null] = each adapter's default)
 *   countrySet  acceptable country codes (null = accept anything)
 *   city        specific city token to require (city scope only)
 */
export function resolveLocation(input) {
  const hay = strip(input).trim();
  if (!hay) {
    return { kind: "any", label: "", queryCodes: [null], countrySet: null, city: null };
  }

  const region = matchRegion(hay);
  if (region) {
    const { members, primary } = REGIONS[region];
    return { kind: "continent", label: region, queryCodes: primary, countrySet: new Set(members), city: null };
  }

  // A specific city wins over the country it's in ("Paris, France" → Paris).
  for (const [city, code] of Object.entries(CITY_TO_CODE)) {
    if (hasWord(hay, city)) {
      return { kind: "city", label: city, queryCodes: [code], countrySet: new Set([code]), city };
    }
  }

  const code = countryByName(hay);
  if (code) {
    return { kind: "country", label: countryName(code), queryCodes: [code], countrySet: new Set([code]), city: null };
  }

  // Unknown place — let JSearch geocode the text and keep what loosely fits.
  return { kind: "unknown", label: hay, queryCodes: [null], countrySet: null, city: null };
}

/** The location hint to send to the APIs for a given queried country code. */
export function whereFor(scope, code) {
  if (scope.kind === "city") return scope.city;
  if (scope.kind === "unknown") return scope.label;
  if (scope.kind === "any") return "";
  return countryName(code) || ""; // country / continent → the country's name
}

/**
 * Does a fetched job satisfy the scope? Country/continent scopes trust the
 * country the job was queried under (only rejecting when the text clearly
 * names a different country); city scopes require the city; unknown does
 * best-effort text matching.
 */
export function acceptsJob(scope, job) {
  const hay = strip(job.location);

  switch (scope.kind) {
    case "any":
      return true;

    case "city": {
      if (!hay || hay === "unknown") return false;
      // Clearly the city we want.
      if (hasWord(hay, scope.city)) return true;
      // Names a *different* known city → not it.
      for (const other of CITY_NAMES) {
        if (other !== scope.city && hasWord(hay, other)) return false;
      }
      // No distinguishing city in the text (many APIs omit it) — trust the
      // country we queried under rather than returning nothing.
      const jc = countryOfLocation(job.location);
      if (jc) return scope.countrySet.has(jc);
      return job.queriedCountry ? scope.countrySet.has(job.queriedCountry) : true;
    }

    case "country":
    case "continent": {
      const jc = countryOfLocation(job.location);
      if (jc) return scope.countrySet.has(jc);
      return job.queriedCountry ? scope.countrySet.has(job.queriedCountry) : true;
    }

    case "unknown": {
      if (!hay || hay === "unknown") return false;
      const want = strip(scope.label);
      if (hay.includes(want)) return true;
      const tokens = want.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
      return tokens.some((t) => hay.includes(t));
    }

    default:
      return true;
  }
}
