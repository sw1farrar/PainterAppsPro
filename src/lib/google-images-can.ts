export type CanImageLookupResult = {
  canImageUrl: string;
  alternateImageUrls: string[];
  productPageUrl: string | null;
  confidence: "high" | "medium" | "low";
  query: string;
};

type SerperImage = {
  title?: string;
  imageUrl?: string;
  link?: string;
  source?: string;
  imageWidth?: number;
  imageHeight?: number;
};

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

function scoreImage(img: SerperImage, brand: string, name: string): number {
  let score = 0;
  const title = (img.title || "").toLowerCase();
  const source = (img.source || "").toLowerCase();
  const url = (img.imageUrl || "").toLowerCase();
  const brandBits = brand.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const nameBits = name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

  for (const bit of brandBits) {
    if (title.includes(bit) || source.includes(bit)) score += 3;
  }
  for (const bit of nameBits) {
    if (title.includes(bit)) score += 4;
  }
  if (/\b(can|gallon|paint|coating|primer)\b/i.test(title)) score += 3;
  if (/\b(logo|icon|swatch|chip|fan.?deck|color.?card)\b/i.test(title)) score -= 8;
  if (/thumb|sprite|icon|logo|favicon/i.test(url)) score -= 6;

  const w = img.imageWidth ?? 0;
  const h = img.imageHeight ?? 0;
  if (w >= 400 && h >= 400) score += 3;
  else if (w >= 200 && h >= 200) score += 1;
  if (w > 0 && h > 0) {
    const ratio = w / h;
    // Paint cans are usually portrait-ish / product shots
    if (ratio >= 0.55 && ratio <= 1.35) score += 2;
  }

  return score;
}

/**
 * Google Images search via Serper for a paint can photo.
 * Query: company + product name.
 */
export async function findPaintProductCanImage(input: {
  name: string;
  brand: string;
}): Promise<CanImageLookupResult> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "SERPER_API_KEY is not set. Add it to .env.local to enable Google Images can import."
    );
  }

  const name = input.name.trim();
  const brand = input.brand.trim() || "Sherwin-Williams";
  if (!name || name.toLowerCase() === "new product") {
    throw new Error("Enter a real product name before finding a can image.");
  }

  const query = `${brand} ${name}`.replace(/\s+/g, " ").trim();

  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: 12,
      gl: "us",
      hl: "en",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Google Images search failed (${res.status}): ${errText.slice(0, 200) || res.statusText}`
    );
  }

  const payload = (await res.json()) as { images?: SerperImage[] };
  const images = Array.isArray(payload.images) ? payload.images : [];

  const ranked = [...images].sort(
    (a, b) => scoreImage(b, brand, name) - scoreImage(a, brand, name)
  );

  const candidates = uniqueUrls(ranked.map((img) => img.imageUrl));
  if (!candidates.length) {
    throw new Error(
      `No Google Images results for "${query}". Try paste/upload instead.`
    );
  }

  const [primary, ...rest] = candidates;
  const topScore = ranked[0] ? scoreImage(ranked[0], brand, name) : 0;

  return {
    canImageUrl: primary,
    alternateImageUrls: rest.slice(0, 7),
    productPageUrl: ranked[0]?.link?.trim() || null,
    confidence: topScore >= 8 ? "high" : topScore >= 3 ? "medium" : "low",
    query,
  };
}
