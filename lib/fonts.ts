/**
 * Font registry for the PDF editor (and any tool that lets the user pick a
 * typeface). Single source of truth shared by the on-screen picker/preview and
 * the vector export in lib/editor.ts.
 *
 * Two kinds of entry:
 *   - "system" fonts (no `src`): rendered in preview using whatever the user
 *     has installed, and approximated in the exported PDF by one of the base-14
 *     PDF fonts (`std`). These never hit the network.
 *   - "embeddable" Google fonts (`src` = a Fontsource package id): the real TTF
 *     is fetched on demand — from jsDelivr's Fontsource mirror, which (unlike
 *     the Google Fonts CSS API) serves uncompressed .ttf that fontkit can embed
 *     — so the preview AND the exported PDF show the actual typeface. True
 *     WYSIWYG. `std` is only used as a fallback if the fetch fails.
 *
 * Fonts ship at most two weights here (400 / 700). Many display & script faces
 * only have a single weight; the 700 URL 404s and callers fall back to 400
 * (the browser/PDF can synthesise bold), so we don't track per-font weights.
 */

export type FontStd = "helvetica" | "times" | "courier";

export interface FontDef {
  /** CSS font-family name. Also the value stored on text objects. */
  family: string;
  /** Dropdown label (defaults to `family`). */
  label?: string;
  /** Fontsource package id. Present = real font fetched & embedded. */
  src?: string;
  /** Base-14 PDF fallback for export when there's no `src` or a fetch fails. */
  std: FontStd;
}

export interface FontGroup {
  label: string;
  fonts: FontDef[];
}

/** [family, fontsourceId] → embeddable FontDef with the given base-14 fallback. */
function g(pairs: [string, string][], std: FontStd): FontDef[] {
  return pairs.map(([family, src]) => ({ family, src, std }));
}

export const FONT_GROUPS: FontGroup[] = [
  {
    label: "Standard",
    fonts: [
      { family: "Calibri", std: "helvetica" },
      { family: "Arial", std: "helvetica" },
      { family: "Helvetica", label: "Sans (Helvetica)", std: "helvetica" },
      { family: "Segoe UI", std: "helvetica" },
      { family: "Verdana", std: "helvetica" },
      { family: "Tahoma", std: "helvetica" },
      { family: "Trebuchet MS", std: "helvetica" },
      { family: "Times New Roman", std: "times" },
      { family: "Georgia", std: "times" },
      { family: "Garamond", std: "times" },
      { family: "Cambria", std: "times" },
      { family: "Palatino Linotype", label: "Palatino", std: "times" },
      { family: "Book Antiqua", std: "times" },
      { family: "Courier New", std: "courier" },
      { family: "Consolas", std: "courier" },
      { family: "Lucida Console", std: "courier" },
    ],
  },
  {
    label: "Sans serif",
    fonts: g(
      [
        ["Inter", "inter"],
        ["Roboto", "roboto"],
        ["Open Sans", "open-sans"],
        ["Lato", "lato"],
        ["Montserrat", "montserrat"],
        ["Poppins", "poppins"],
        ["Raleway", "raleway"],
        ["Nunito", "nunito"],
        ["Nunito Sans", "nunito-sans"],
        ["Work Sans", "work-sans"],
        ["Source Sans 3", "source-sans-3"],
        ["Rubik", "rubik"],
        ["Mulish", "mulish"],
        ["DM Sans", "dm-sans"],
        ["Manrope", "manrope"],
        ["Karla", "karla"],
        ["Barlow", "barlow"],
        ["Oswald", "oswald"],
        ["Quicksand", "quicksand"],
        ["Josefin Sans", "josefin-sans"],
        ["Cabin", "cabin"],
        ["Fira Sans", "fira-sans"],
        ["PT Sans", "pt-sans"],
        ["Heebo", "heebo"],
        ["Outfit", "outfit"],
        ["Public Sans", "public-sans"],
        ["Figtree", "figtree"],
        ["Plus Jakarta Sans", "plus-jakarta-sans"],
        ["Sora", "sora"],
        ["Albert Sans", "albert-sans"],
        ["Onest", "onest"],
        ["Lexend", "lexend"],
        ["Kanit", "kanit"],
        ["Hind", "hind"],
        ["Assistant", "assistant"],
        ["Titillium Web", "titillium-web"],
        ["Archivo", "archivo"],
        ["Red Hat Display", "red-hat-display"],
        ["Schibsted Grotesk", "schibsted-grotesk"],
        ["Geist", "geist"],
      ],
      "helvetica",
    ),
  },
  {
    label: "Serif",
    fonts: g(
      [
        ["Merriweather", "merriweather"],
        ["Playfair Display", "playfair-display"],
        ["Lora", "lora"],
        ["PT Serif", "pt-serif"],
        ["Noto Serif", "noto-serif"],
        ["Roboto Slab", "roboto-slab"],
        ["Source Serif 4", "source-serif-4"],
        ["Bitter", "bitter"],
        ["Crimson Text", "crimson-text"],
        ["EB Garamond", "eb-garamond"],
        ["Cormorant Garamond", "cormorant-garamond"],
        ["Libre Baskerville", "libre-baskerville"],
        ["Domine", "domine"],
        ["Spectral", "spectral"],
        ["Frank Ruhl Libre", "frank-ruhl-libre"],
        ["Zilla Slab", "zilla-slab"],
        ["Bodoni Moda", "bodoni-moda"],
        ["DM Serif Display", "dm-serif-display"],
        ["DM Serif Text", "dm-serif-text"],
        ["Cardo", "cardo"],
        ["Vollkorn", "vollkorn"],
        ["Libre Caslon Text", "libre-caslon-text"],
        ["Cormorant", "cormorant"],
        ["Newsreader", "newsreader"],
        ["Petrona", "petrona"],
        ["Alegreya", "alegreya"],
        ["Noticia Text", "noticia-text"],
        ["Slabo 27px", "slabo-27px"],
      ],
      "times",
    ),
  },
  {
    label: "Monospace",
    fonts: g(
      [
        ["Roboto Mono", "roboto-mono"],
        ["Source Code Pro", "source-code-pro"],
        ["JetBrains Mono", "jetbrains-mono"],
        ["Fira Code", "fira-code"],
        ["IBM Plex Mono", "ibm-plex-mono"],
        ["Space Mono", "space-mono"],
        ["Inconsolata", "inconsolata"],
        ["Ubuntu Mono", "ubuntu-mono"],
        ["DM Mono", "dm-mono"],
        ["Overpass Mono", "overpass-mono"],
        ["Geist Mono", "geist-mono"],
        ["Martian Mono", "martian-mono"],
      ],
      "courier",
    ),
  },
  {
    label: "Display",
    fonts: g(
      [
        ["Bebas Neue", "bebas-neue"],
        ["Anton", "anton"],
        ["Archivo Black", "archivo-black"],
        ["Abril Fatface", "abril-fatface"],
        ["Righteous", "righteous"],
        ["Lobster", "lobster"],
        ["Comfortaa", "comfortaa"],
        ["Fredoka", "fredoka"],
        ["Titan One", "titan-one"],
        ["Bungee", "bungee"],
        ["Alfa Slab One", "alfa-slab-one"],
        ["Passion One", "passion-one"],
        ["Staatliches", "staatliches"],
        ["Teko", "teko"],
        ["Bowlby One SC", "bowlby-one-sc"],
        ["Russo One", "russo-one"],
        ["Fjalla One", "fjalla-one"],
        ["Bangers", "bangers"],
        ["Monoton", "monoton"],
        ["Ultra", "ultra"],
      ],
      "helvetica",
    ),
  },
  {
    label: "Handwriting & Script",
    fonts: g(
      [
        ["Dancing Script", "dancing-script"],
        ["Pacifico", "pacifico"],
        ["Caveat", "caveat"],
        ["Satisfy", "satisfy"],
        ["Great Vibes", "great-vibes"],
        ["Sacramento", "sacramento"],
        ["Shadows Into Light", "shadows-into-light"],
        ["Indie Flower", "indie-flower"],
        ["Permanent Marker", "permanent-marker"],
        ["Kalam", "kalam"],
        ["Patrick Hand", "patrick-hand"],
        ["Courgette", "courgette"],
        ["Cookie", "cookie"],
        ["Allura", "allura"],
        ["Parisienne", "parisienne"],
        ["Homemade Apple", "homemade-apple"],
        ["Yellowtail", "yellowtail"],
        ["Tangerine", "tangerine"],
        ["Marck Script", "marck-script"],
        ["Gloria Hallelujah", "gloria-hallelujah"],
      ],
      "times",
    ),
  },
];

/** Flat list of every font, in group order. */
export const FONTS: FontDef[] = FONT_GROUPS.flatMap((grp) => grp.fonts);

const BY_FAMILY = new Map(FONTS.map((f) => [f.family, f]));

/** Look up a registered font by its family name (the value stored on objects). */
export function fontDef(family: string): FontDef | undefined {
  return BY_FAMILY.get(family);
}

/** jsDelivr Fontsource URL for an uncompressed TTF (embeddable + previewable). */
export function fontTtfUrl(src: string, bold: boolean): string {
  return `https://cdn.jsdelivr.net/fontsource/fonts/${src}@latest/latin-${bold ? 700 : 400}-normal.ttf`;
}

// --- preview loading (browser only) -----------------------------------------

const loading = new Map<string, Promise<void>>();

/**
 * Ensure a font is available to the browser so previews render in the real
 * typeface. No-op for system fonts and on the server. Idempotent + cached; the
 * 700 weight is best-effort (single-weight faces 404 and fall back to faux-bold).
 */
export function loadWebFont(family: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const def = BY_FAMILY.get(family);
  if (!def?.src) return Promise.resolve();
  let p = loading.get(family);
  if (p) return p;
  p = (async () => {
    const add = async (bold: boolean) => {
      try {
        const face = new FontFace(family, `url(${fontTtfUrl(def.src!, bold)})`, {
          weight: bold ? "700" : "400",
          display: "swap",
        });
        document.fonts.add(await face.load());
      } catch {
        /* weight unavailable — fine */
      }
    };
    await add(false);
    await add(true);
  })();
  loading.set(family, p);
  return p;
}
