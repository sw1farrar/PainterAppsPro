export type DataSheetLookupResult = {
  dataSheetUrl: string;
  alternateUrls: string[];
  title: string | null;
  confidence: "high" | "medium" | "low";
  query: string;
};

type SerperOrganic = {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
};

/** Official hosts / PDF CDNs by brand (matched loosely against brand string). */
const BRAND_PDF_HOSTS: Array<{ match: string; hosts: string[] }> = [
  {
    match: "sherwin",
    hosts: [
      "sherlink.sherwin.com",
      "images.sherwin-williams.com",
      "sherwin-williams.com",
      "www.sherwin-williams.com",
    ],
  },
  {
    match: "benjamin moore",
    hosts: [
      "media.benjaminmoore.com",
      "benjaminmoore.com",
      "www.benjaminmoore.com",
    ],
  },
  {
    match: "behr",
    hosts: ["behr.com", "www.behr.com"],
  },
  {
    match: "ppg",
    hosts: ["ppg.com", "www.ppg.com", "ppgpaints.com", "www.ppgpaints.com"],
  },
  {
    match: "valspar",
    hosts: ["valspar.com", "www.valspar.com"],
  },
  {
    match: "kilz",
    hosts: ["kilz.com", "www.kilz.com"],
  },
  {
    match: "zinsser",
    hosts: ["zinsser.com", "www.zinsser.com", "rustoleum.com", "www.rustoleum.com"],
  },
];

function hostsForBrand(brand: string): string[] {
  const key = brand.trim().toLowerCase();
  for (const row of BRAND_PDF_HOSTS) {
    if (key.includes(row.match) || row.match.includes(key)) return row.hosts;
  }
  return [];
}

/** Strong identity tokens from the product name (drops generic paint words). */
function identityTokens(name: string): string[] {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "interior",
    "exterior",
    "paint",
    "latex",
    "acrylic",
    "enamel",
    "coating",
    "coatings",
    "series",
    "waterborne",
    "waterbased",
    "premium",
    "all",
    "purpose",
    "flat",
    "matte",
    "eggshell",
    "satin",
    "gloss",
  ]);
  return name
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !stop.has(w));
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      seen.add(url);
      out.push(url);
    } catch {
      /* skip */
    }
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function pathOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.toLowerCase());
  } catch {
    return "";
  }
}

function isOfficialHost(url: string, officialHosts: string[]): boolean {
  const host = hostOf(url);
  if (!host || !officialHosts.length) return false;
  return officialHosts.some(
    (h) => host === h || host.endsWith(`.${h}`) || host.includes(h)
  );
}

function isDirectPdfUrl(url: string): boolean {
  return pathOf(url).endsWith(".pdf");
}

/** Sherwin official product-data endpoint (returns a real PDF). */
function isSherlinkProductData(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.toLowerCase().includes("sherlink.sherwin.com") &&
      /type=DP/i.test(u.search)
    );
  } catch {
    return false;
  }
}

function isRejectedDoc(title: string, url: string): boolean {
  const hay = `${title} ${url}`.toLowerCase();
  return (
    /\b(sds|msds|safety data)\b/.test(hay) ||
    /\b(epd|environmental product declaration)\b/.test(hay) ||
    /\/msds_|\/sds_|_sds_|\bsafety-data\b/.test(hay) ||
    /\b(master.?spec|mpi guide|brush.?roller|sheen and gloss|selection gui|carb |scaqmd)\b/.test(
      hay
    ) ||
    /master-spec|mpi-catalog|brush-roller|sheen-gloss|carbint|scaqmd/i.test(hay) ||
    /\b(warranty|limited warranty|cust.?info)\b/.test(hay) ||
    /warranty|cust-info|cust_info/i.test(hay)
  );
}

/** Only keep links we can actually store as a PDF. */
function isDownloadableCandidate(url: string): boolean {
  return isDirectPdfUrl(url) || isSherlinkProductData(url);
}

function tokenHits(haystack: string, tokens: string[]): number {
  const h = haystack.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (h.includes(t)) hits += 1;
  }
  return hits;
}

function scoreDataSheet(
  item: SerperOrganic,
  name: string,
  officialHosts: string[]
): number {
  const title = (item.title || "").replace(/[™®©]/g, "");
  const link = item.link || "";
  const path = pathOf(link);

  if (!link || isRejectedDoc(title, link)) return -1000;

  const idTokens = identityTokens(name);
  if (!idTokens.length) return -1000;

  // Match ONLY title + URL path (never snippet — snippets cause false positives).
  const titleHits = tokenHits(title, idTokens);
  const pathHits = tokenHits(path, idTokens);
  const bestHits = Math.max(titleHits, pathHits);
  const coverage = bestHits / idTokens.length;

  // Require a real product-name match in the title or filename/path.
  if (bestHits === 0) return -1000;
  if (coverage < 0.5 && titleHits === 0) return -1000;
  if (idTokens.length >= 2 && titleHits < 1 && pathHits < 2) return -1000;

  let score = 0;
  score += titleHits * 18;
  score += pathHits * 10;
  score += Math.round(coverage * 25);

  const official = isOfficialHost(link, officialHosts);
  if (official) score += 25;
  else score -= 20;

  // Official SW product data page — only if title matches the product
  if (isSherlinkProductData(link) && titleHits >= Math.min(2, idTokens.length)) {
    score += 45;
  } else if (isSherlinkProductData(link)) {
    // sherlink with weak title match is often the wrong SKU
    score -= 30;
  }

  // True technical data sheet paths (Benjamin Moore style, etc.)
  if (/\/datasheets?\/|\/tds[_/]|_tds_|[-_/]tds[-_/]/i.test(path + link)) {
    score += 35;
  }
  if (/\b(tds|technical data)\b/i.test(title)) score += 20;
  if (/\bproduct data\b/i.test(title) && official) score += 12;

  if (isDirectPdfUrl(link)) score += 8;
  if (!isDirectPdfUrl(link) && !isSherlinkProductData(link)) score -= 25;

  // Sell sheets / brochures weaker than TDS/DP, but still OK as fallbacks
  if (/\b(sell sheet|brochure)\b/i.test(title)) score -= 6;
  if (/sellsheets?|brochure/i.test(path)) score -= 8;

  // Manufacturer product PDF naming (SW-PDF-DURATION-HOME, etc.)
  if (/\/sw-pdf-[a-z0-9-]+\.pdf$/i.test(path) && pathHits > 0) score += 14;

  return score;
}

async function serperSearch(
  apiKey: string,
  query: string
): Promise<SerperOrganic[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: 10,
      gl: "us",
      hl: "en",
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Google Search failed (${res.status}): ${errText.slice(0, 200) || res.statusText}`
    );
  }
  const payload = (await res.json()) as { organic?: SerperOrganic[] };
  return Array.isArray(payload.organic) ? payload.organic : [];
}

function buildQueries(
  brand: string,
  name: string,
  officialHosts: string[]
): string[] {
  const quotedName = `"${name.replace(/"/g, "")}"`;
  const shortName = name
    .replace(/\b(interior|exterior|acrylic|latex|paint|enamel)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const quotedShort = shortName ? `"${shortName.replace(/"/g, "")}"` : quotedName;

  const queries = [
    `${brand} ${quotedName} ("technical data sheet" OR TDS OR "product data sheet") filetype:pdf`,
    `${brand} ${quotedShort} (TDS OR "technical data sheet" OR "product data") filetype:pdf`,
    `${quotedName} ${brand} TDS filetype:pdf`,
  ];

  for (const host of officialHosts.slice(0, 3)) {
    queries.push(
      `${quotedShort} site:${host} (TDS OR "product data" OR datasheet OR filetype:pdf)`
    );
  }

  if (/sherwin/i.test(brand)) {
    queries.push(`${quotedName} site:sherlink.sherwin.com`);
    queries.push(`${quotedShort} site:sherlink.sherwin.com`);
    queries.push(
      `${quotedShort} site:images.sherwin-williams.com filetype:pdf`
    );
  }

  if (/benjamin/i.test(brand)) {
    queries.push(
      `${quotedShort} site:media.benjaminmoore.com/datasheets TDS filetype:pdf`
    );
  }

  return queries;
}

/**
 * Google Search via Serper for a manufacturer product data sheet PDF.
 * Multiple targeted queries + title/path matching + official-host preference.
 */
export async function findPaintProductDataSheet(input: {
  name: string;
  brand: string;
}): Promise<DataSheetLookupResult> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "SERPER_API_KEY is not set. Add it to .env.local to enable data sheet import."
    );
  }

  const name = input.name.trim();
  const brand = input.brand.trim() || "Sherwin-Williams";
  if (!name || name.toLowerCase() === "new product") {
    throw new Error("Enter a real product name before finding a data sheet.");
  }

  const officialHosts = hostsForBrand(brand);
  const queries = buildQueries(brand, name, officialHosts);

  const batches = await Promise.all(
    queries.map(async (q) => {
      try {
        return await serperSearch(apiKey, q);
      } catch {
        return [] as SerperOrganic[];
      }
    })
  );

  const byLink = new Map<string, SerperOrganic>();
  for (const batch of batches) {
    for (const item of batch) {
      const link = item.link?.trim();
      if (!link || byLink.has(link)) continue;
      byLink.set(link, item);
    }
  }

  const ranked = [...byLink.values()]
    .filter((item) => isDownloadableCandidate(item.link || ""))
    .map((item) => ({
      item,
      score: scoreDataSheet(item, name, officialHosts),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    throw new Error(
      `No matching data sheet PDF found for "${brand} ${name}".`
    );
  }

  const officialRanked = ranked.filter((r) =>
    isOfficialHost(r.item.link || "", officialHosts)
  );
  const pool = officialRanked.length ? officialRanked : ranked;

  const candidates = uniqueUrls(pool.map((r) => r.item.link));
  const [primary, ...rest] = candidates;
  const top = pool[0];

  return {
    dataSheetUrl: primary,
    alternateUrls: rest.slice(0, 8),
    title: top?.item.title?.trim() || null,
    confidence:
      (top?.score ?? 0) >= 70
        ? "high"
        : (top?.score ?? 0) >= 40
          ? "medium"
          : "low",
    query: queries[0],
  };
}
