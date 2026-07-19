import { z } from "zod";

const productLookupSchema = z.object({
  features: z.string().optional().nullable(),
  coverageSqftPerGallon: z.number().positive().optional().nullable(),
  sheens: z.array(z.string()).optional().nullable(),
  category: z
    .enum([
      "interior",
      "exterior",
      "both",
      "interior_primer",
      "exterior_primer",
      "both_primer",
    ])
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),
  productPageUrl: z.string().optional().nullable(),
  // Ignored if the model still returns it — never applied to the product.
  canImageUrl: z.string().optional().nullable(),
});

export type ProductLookupResult = z.infer<typeof productLookupSchema>;

const catalogProductSchema = z.object({
  name: z.string().min(1),
  category: z
    .enum([
      "interior",
      "exterior",
      "both",
      "interior_primer",
      "exterior_primer",
      "both_primer",
    ])
    .optional()
    .nullable(),
  coverageSqftPerGallon: z.number().positive().optional().nullable(),
  sheens: z.array(z.string()).optional().nullable(),
  features: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  pricePerGallon: z.number().min(0).optional().nullable(),
});

const catalogSchema = z.object({
  brand: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  products: z.array(catalogProductSchema).min(1),
});

export type ManufacturerCatalogProduct = z.infer<typeof catalogProductSchema>;
export type ManufacturerCatalogResult = {
  brand: string;
  website: string | null;
  products: ManufacturerCatalogProduct[];
};

const BRAND_DOMAINS: Record<string, string[]> = {
  "sherwin-williams": [
    "sherwin-williams.com",
    "www.sherwin-williams.com",
  ],
  sherwin: ["sherwin-williams.com", "www.sherwin-williams.com"],
  "benjamin moore": ["benjaminmoore.com", "www.benjaminmoore.com"],
  behr: ["behr.com", "www.behr.com"],
  ppg: ["ppg.com", "www.ppg.com", "ppgpaints.com"],
  valspar: ["valspar.com", "www.valspar.com"],
  "dutch boy": ["dutchboy.com", "www.dutchboy.com"],
  kilz: ["kilz.com", "www.kilz.com"],
  zinsser: ["rustoleum.com", "www.rustoleum.com", "zinsser.com"],
};

function domainsForBrand(brand: string): string[] | undefined {
  const key = brand.trim().toLowerCase();
  for (const [name, domains] of Object.entries(BRAND_DOMAINS)) {
    if (key.includes(name) || name.includes(key)) return domains;
  }
  return undefined;
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? text.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in model response");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeProductName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Compare product names ignoring case, spacing, and trademark marks. */
export function productNameKey(name: string): string {
  return normalizeProductName(name)
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;
  if (typeof obj.output_text === "string" && obj.output_text.trim()) {
    return obj.output_text;
  }
  const output = obj.output;
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (entry.type !== "message") continue;
    const content = entry.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") chunks.push(p.text);
      if (typeof p.output_text === "string") chunks.push(p.output_text);
    }
  }
  return chunks.join("\n").trim();
}

async function xaiResponses(input: {
  apiKey: string;
  prompt: string;
  allowedDomains?: string[];
  enableImageSearch?: boolean;
  enableImageUnderstanding?: boolean;
}): Promise<{ text: string }> {
  const tool: Record<string, unknown> = {
    type: "web_search",
    enable_image_search: input.enableImageSearch ?? false,
    enable_image_understanding: input.enableImageUnderstanding ?? false,
  };
  if (input.allowedDomains?.length) {
    tool.filters = {
      allowed_domains: input.allowedDomains.slice(0, 5),
    };
  }

  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL?.trim() || "grok-4.5",
      input: [{ role: "user", content: input.prompt }],
      tools: [tool],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `xAI lookup failed (${res.status}): ${errText.slice(0, 240) || res.statusText}`
    );
  }

  const payload = (await res.json()) as unknown;
  return { text: extractOutputText(payload) };
}

/**
 * Uses xAI Grok with web_search to find manufacturer product attributes.
 */
export async function lookupPaintProductFromManufacturer(input: {
  name: string;
  brand: string;
}): Promise<ProductLookupResult> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "XAI_API_KEY is not set. Add it to .env.local to enable AI product lookup."
    );
  }

  const name = input.name.trim();
  const brand = input.brand.trim() || "Sherwin-Williams";
  if (!name || name.toLowerCase() === "new product") {
    throw new Error("Enter a real product name before running AI lookup.");
  }

  const domains = domainsForBrand(brand);
  const domainHint = domains?.length
    ? `Prefer official pages on: ${domains.join(", ")}.`
    : "Prefer the manufacturer's official website.";

  const prompt = `Find the official product page for this paint product on the manufacturer's website and extract text attributes only.

Brand: ${brand}
Product name: ${name}

${domainHint}

Browse the manufacturer product page for specs and features. Do NOT search for or return any product images or can photos.

Return ONLY a JSON object (no markdown commentary) with:
{
  "features": "short bullet-style feature summary for painters/estimators (2-6 sentences or bullets)",
  "coverageSqftPerGallon": number or null,
  "sheens": ["available sheen names"] or null,
  "category": "interior" | "exterior" | "both" | "interior_primer" | "exterior_primer" | "both_primer" or null,
  "notes": "optional short technical notes" or null,
  "productPageUrl": "official product URL" or null
}

Rules:
- Use manufacturer data when available.
- coverageSqftPerGallon should be theoretical/recommended sq ft per gallon if published.
- sheens must be sheens actually offered for this product line.
- Never include image URLs.
- If a field is unknown, use null. Do not invent prices.`;

  let { text } = await xaiResponses({
    apiKey,
    prompt,
    allowedDomains: domains,
    enableImageSearch: false,
    enableImageUnderstanding: false,
  });

  if (!text) {
    throw new Error("xAI returned an empty response.");
  }

  let parsed: ProductLookupResult;
  try {
    parsed = productLookupSchema.parse(extractJsonObject(text));
  } catch {
    ({ text } = await xaiResponses({
      apiKey,
      prompt: `Find official text attributes for paint product "${brand} ${name}" from the manufacturer website. Return ONLY JSON with keys features, coverageSqftPerGallon, sheens, category, notes, productPageUrl. Do not include images.`,
      enableImageSearch: false,
      enableImageUnderstanding: false,
    }));
    parsed = productLookupSchema.parse(extractJsonObject(text));
  }

  // Can images are uploaded/pasted manually — never return AI image URLs.
  return { ...parsed, canImageUrl: null };
}

/**
 * Uses xAI Grok + web_search to list architectural paint lines from a manufacturer site.
 */
export async function discoverManufacturerPaintCatalog(input: {
  manufacturer: string;
  /** Product names already in the library — exclude these from results. */
  excludeNames?: string[];
}): Promise<ManufacturerCatalogResult> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "XAI_API_KEY is not set. Add it to .env.local to enable AI catalog import."
    );
  }

  const manufacturer = input.manufacturer.trim();
  if (manufacturer.length < 2) {
    throw new Error("Enter a paint manufacturer name.");
  }

  const excludeKeys = new Set(
    (input.excludeNames ?? []).map(productNameKey).filter(Boolean)
  );
  const excludeList = (input.excludeNames ?? [])
    .map(normalizeProductName)
    .filter(Boolean);
  const domains = domainsForBrand(manufacturer);
  const domainHint = domains?.length
    ? `Prefer official pages on: ${domains.join(", ")}.`
    : "Prefer the manufacturer's official website.";
  const excludeHint =
    excludeList.length > 0
      ? `Do NOT include these products already in our library:\n${excludeList
          .slice(0, 200)
          .map((n) => `- ${n}`)
          .join("\n")}`
      : "Include all distinct architectural product lines you find.";

  const prompt = `Go to the official website for this paint manufacturer and find their architectural / professional paint product lines.

Manufacturer: ${manufacturer}
${domainHint}

Focus on coatings for professional painters and estimators (interior paint, exterior paint, primers). Skip individual color SKUs, stain colors, and tiny specialty SKUs.

${excludeHint}

Return ONLY a JSON object (no markdown commentary):
{
  "brand": "canonical brand name",
  "website": "official site URL" or null,
  "products": [
    {
      "name": "product line name",
      "category": "interior" | "exterior" | "both" | "interior_primer" | "exterior_primer" | "both_primer",
      "coverageSqftPerGallon": number or null,
      "sheens": ["sheen names"] or null,
      "features": "short feature summary for estimators" or null,
      "notes": "optional short notes" or null,
      "pricePerGallon": typical gallon street price number or null
    }
  ]
}

Rules:
- Return every distinct architectural product line you can find on the site (no artificial count limit).
- Use real product names from the manufacturer site.
- Do not invent products.
- Never include image URLs.
- Never repeat products from the already-in-library list above.
- If coverage or sheens are unknown, use null.`;

  let { text } = await xaiResponses({
    apiKey,
    prompt,
    allowedDomains: domains,
    enableImageSearch: false,
    enableImageUnderstanding: false,
  });

  if (!text) {
    throw new Error("xAI returned an empty catalog response.");
  }

  let parsed: z.infer<typeof catalogSchema>;
  try {
    parsed = catalogSchema.parse(extractJsonObject(text));
  } catch {
    ({ text } = await xaiResponses({
      apiKey,
      prompt: `List architectural paint product lines from "${manufacturer}" official website. Exclude already-owned: ${excludeList.slice(0, 80).join("; ") || "(none)"}. Return ONLY JSON: {"brand":"...","website":null,"products":[{"name":"...","category":"interior","coverageSqftPerGallon":null,"sheens":null,"features":null,"notes":null,"pricePerGallon":null}]}. No images. No count limit.`,
      enableImageSearch: false,
      enableImageUnderstanding: false,
    }));
    parsed = catalogSchema.parse(extractJsonObject(text));
  }

  const brand = (parsed.brand?.trim() || manufacturer).trim();
  const seen = new Set<string>();
  const products: ManufacturerCatalogProduct[] = [];
  for (const p of parsed.products) {
    const name = normalizeProductName(p.name);
    const key = productNameKey(name);
    if (!name || !key || seen.has(key) || excludeKeys.has(key)) continue;
    seen.add(key);
    products.push({ ...p, name });
  }

  if (!products.length) {
    if (excludeKeys.size > 0) {
      throw new Error(
        `No new products found for "${manufacturer}" — library already has matching lines.`
      );
    }
    throw new Error(`No products found for "${manufacturer}".`);
  }

  return {
    brand,
    website: parsed.website?.trim() || null,
    products,
  };
}
