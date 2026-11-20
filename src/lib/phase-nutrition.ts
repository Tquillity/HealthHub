import { z } from 'zod';
import type { CyclePhase } from './cycle-calculator';
import { normalizeLeanRole } from './lean-kitchen';

/**
 * Biological Fueling: which nutrients suit each cycle phase, and which recipes
 * provide them. Pure and client-safe (no Prisma, no session).
 *
 * The phase guidance follows what HealthHub already shows on the cycle page:
 * - src/lib/dietary-recommendations.ts (menstrual: iron-rich + anti-inflammatory
 *   foods; follicular: light proteins, leafy greens, fermented foods; ovulation: raw
 *   vegetables, seeds; luteal: complex carbs, healthy fats, magnesium-rich foods),
 *   based on Lara Briden, *Period Repair Manual*, and Toni Weschler, *Taking Charge of
 *   Your Fertility*.
 * - The expert nutrition content seeded in src/db/seed.ts (Dr. Mindy Pelz via London
 *   Clinic of Nutrition, "Foods to eat for each stage of your menstrual cycle"): iron-
 *   rich foods while bleeding; complex carbohydrates and magnesium in the luteal phase.
 * - Issue #2 (owner's spec): iron while menstruating, protein and complex carbs in the
 *   follicular phase, nutrient-dense meals around ovulation, magnesium and complex carbs
 *   in the luteal phase.
 *
 * Evidence for "cycle syncing" food choices is limited (see the cycle disclaimer), so
 * everything here is a gentle preference: recipes are favored, never excluded, and the
 * copy stays non-medical.
 */

export const CYCLE_PHASES = [
  'menstrual',
  'follicular',
  'ovulation',
  'luteal',
] as const satisfies readonly CyclePhase[];

export const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

/** Controlled vocabulary for Recipe.nutrientHighlights (stored as these exact keys). */
export const NUTRIENT_HIGHLIGHTS = [
  'iron',
  'magnesium',
  'protein',
  'complex-carbs',
  'omega-3',
  'fiber',
  'vitamin-b6',
  'zinc',
  'vitamin-c',
  'calcium',
  'antioxidants',
] as const;
export type NutrientHighlight = (typeof NUTRIENT_HIGHLIGHTS)[number];

export const NUTRIENT_LABELS: Record<NutrientHighlight, string> = {
  iron: 'Iron',
  magnesium: 'Magnesium',
  protein: 'Protein',
  'complex-carbs': 'Complex carbs',
  'omega-3': 'Omega-3',
  fiber: 'Fiber',
  'vitamin-b6': 'Vitamin B6',
  zinc: 'Zinc',
  'vitamin-c': 'Vitamin C',
  calcium: 'Calcium',
  antioxidants: 'Antioxidants',
};

/** Mid-sentence wording ("rich in iron and omega-3 fats"). */
const NUTRIENT_PHRASES: Record<NutrientHighlight, string> = {
  iron: 'iron',
  magnesium: 'magnesium',
  protein: 'protein',
  'complex-carbs': 'complex carbs',
  'omega-3': 'omega-3 fats',
  fiber: 'fiber',
  'vitamin-b6': 'vitamin B6',
  zinc: 'zinc',
  'vitamin-c': 'vitamin C',
  calcium: 'calcium',
  antioxidants: 'antioxidants',
};

export interface PhaseNutritionFocus {
  /**
   * Nutrients that make a recipe a match for the phase. A recipe supports the phase
   * when it is a good source of at least one of them.
   */
  focus: readonly NutrientHighlight[];
  /** Helpful alongside the focus nutrients; mentioned in copy but never enough alone. */
  supporting: readonly NutrientHighlight[];
  /** One line for the generator explanation. */
  headline: string;
  /** Why it may help, in friendly non-medical words (badge tooltip). */
  benefit: string;
}

/**
 * Phase → nutrients. Sources for the physiology behind each choice:
 * - Menstrual: iron replaces what is lost with menstrual blood, and vitamin C helps the
 *   body absorb iron from plant foods (NIH Office of Dietary Supplements, Iron fact
 *   sheet, https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/). Omega-3 fats
 *   are the classic "anti-inflammatory food" from dietary-recommendations.ts; a small
 *   RCT found less period pain with omega-3 (Rahbar et al., Int J Gynaecol Obstet
 *   2012;117(1):45-47).
 * - Follicular: protein and complex carbs (issue #2), "light proteins" and leafy greens
 *   (dietary-recommendations.ts), healthy fats and proteins (Pelz).
 * - Ovulation: raw vegetables and seeds (dietary-recommendations.ts), i.e. colorful
 *   produce rich in antioxidants and vitamin C; seeds add zinc, which Briden recommends
 *   for healthy ovulation (Period Repair Manual). "Nutrient-dense meals" (issue #2).
 * - Luteal: complex carbs and magnesium (dietary-recommendations.ts, Pelz, issue #2).
 *   Energy needs rise slightly in the luteal phase (Davidsen et al., Int J Obes
 *   2007;31:1777-1785). Magnesium (Walker et al., J Womens Health 1998;7(9):1157-1165),
 *   vitamin B6 (Wyatt et al., BMJ 1999;318:1375-1381) and calcium (Thys-Jacobs et al.,
 *   Am J Obstet Gynecol 1998;179(2):444-452) have been studied for premenstrual symptoms.
 */
export const PHASE_NUTRITION: Record<CyclePhase, PhaseNutritionFocus> = {
  menstrual: {
    focus: ['iron', 'omega-3'],
    supporting: ['vitamin-c', 'protein'],
    headline: 'Menstrual days favor iron-rich meals and omega-3 fats.',
    benefit:
      'Iron helps replace what your body loses during your period, and omega-3 fats are known for their soothing, anti-inflammatory role.',
  },
  follicular: {
    focus: ['protein', 'complex-carbs'],
    supporting: ['fiber'],
    headline: 'Follicular days favor protein and complex carbs.',
    benefit:
      'Protein and slow-release carbs are a steady way to build energy as estrogen rises.',
  },
  ovulation: {
    focus: ['antioxidants', 'vitamin-c', 'zinc'],
    supporting: ['fiber'],
    headline: 'Ovulation days favor colorful produce and seeds.',
    benefit:
      'Colorful produce and seeds bring antioxidants, vitamin C and zinc: light, nutrient-dense fuel for what are often your highest-energy days.',
  },
  luteal: {
    focus: ['magnesium', 'complex-carbs'],
    supporting: ['vitamin-b6', 'calcium'],
    headline: 'Luteal days favor magnesium-rich meals and complex carbs.',
    benefit:
      'Magnesium and slow-release carbs may help keep energy and mood steadier in the days before your period.',
  },
};

/** "a", "a and b", "a, b and c". */
export function formatList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function formatNutrientList(nutrients: readonly NutrientHighlight[]): string {
  return formatList(nutrients.map((nutrient) => NUTRIENT_PHRASES[nutrient]));
}

// ---------------------------------------------------------------------------
// Vocabulary validation (recipe form, actions, seed manifest)
// ---------------------------------------------------------------------------

function isPhase(value: string): value is CyclePhase {
  return (CYCLE_PHASES as readonly string[]).includes(value);
}

function isNutrient(value: string): value is NutrientHighlight {
  return (NUTRIENT_HIGHLIGHTS as readonly string[]).includes(value);
}

/** Lowercases, trims and de-duplicates string entries; anything else is left for zod. */
function normalizeTagList(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      out.push(entry);
      continue;
    }
    const key = entry.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Stored in vocabulary order so the same set always looks the same. */
function inVocabularyOrder<T extends string>(vocabulary: readonly T[], values: readonly T[]): T[] {
  const set = new Set(values);
  return vocabulary.filter((value) => set.has(value));
}

export const phaseTagsSchema = z.preprocess(
  normalizeTagList,
  z
    .array(
      z.enum(CYCLE_PHASES, {
        error: 'Cycle phase must be menstrual, follicular, ovulation or luteal',
      })
    )
    .max(CYCLE_PHASES.length)
    .transform((values) => inVocabularyOrder(CYCLE_PHASES, values))
);

export const nutrientHighlightsSchema = z.preprocess(
  normalizeTagList,
  z
    .array(
      z.enum(NUTRIENT_HIGHLIGHTS, {
        error: `Nutrient must be one of: ${NUTRIENT_HIGHLIGHTS.join(', ')}`,
      })
    )
    .max(NUTRIENT_HIGHLIGHTS.length)
    .transform((values) => inVocabularyOrder(NUTRIENT_HIGHLIGHTS, values))
);

/** Known phases from a stored row, ignoring anything outside the vocabulary. */
export function sanitizePhaseTags(values: readonly string[] | null | undefined): CyclePhase[] {
  const known = (values ?? []).map((value) => value.trim().toLowerCase()).filter(isPhase);
  return inVocabularyOrder(CYCLE_PHASES, known);
}

/** Known nutrients from a stored row, ignoring anything outside the vocabulary. */
export function sanitizeNutrientHighlights(
  values: readonly string[] | null | undefined
): NutrientHighlight[] {
  const known = (values ?? []).map((value) => value.trim().toLowerCase()).filter(isNutrient);
  return inVocabularyOrder(NUTRIENT_HIGHLIGHTS, known);
}

// ---------------------------------------------------------------------------
// Inference from ingredient names (Swedish and English)
// ---------------------------------------------------------------------------

/**
 * One food group. Ingredient names are lowercased and split into words (letters only,
 * so "Nötfärs (gärna 10%)" → ["nötfärs", "gärna"]). A rule matches when:
 * - `stems`: a word contains the stem. Swedish builds compounds ("pumpafrön",
 *   "laxfilé", "babyspenat"), so most Swedish terms are stems.
 * - `prefixes` / `suffixes`: a word starts / ends with the term ("äggula", "getost").
 * - `words`: a word equals the term. Used for English and for short Swedish words that
 *   would otherwise hide inside other words.
 * - `phrases`: the words appear in this order ("dark chocolate", "mörk choklad").
 * - `exclude`: none of these appear anywhere in the name (stock cubes, oils, drinks,
 *   zest...). Checked as plain substrings of the lowercased name.
 *
 * Nutrient content per food group follows USDA FoodData Central
 * (https://fdc.nal.usda.gov/) and the Swedish Food Agency's food database
 * (Livsmedelsverket, https://soknaringsinnehall.livsmedelsverket.se/). A food is listed
 * for a nutrient only when a normal portion is at least a "source" of it (roughly 15% of
 * the EU nutrient reference value, Regulation (EU) No 1169/2011, Annex XIII).
 */
interface NutrientKeywordRule {
  label: string;
  stems?: readonly string[];
  prefixes?: readonly string[];
  suffixes?: readonly string[];
  words?: readonly string[];
  phrases?: readonly string[];
  exclude?: readonly string[];
  nutrients: readonly NutrientHighlight[];
}

const STOCK = ['fond', 'buljong', 'stock', 'broth', 'bouillon'];
const OILS = ['olja', 'oil'];
const PLANT_DRINKS = ['dryck', 'drink', 'mjölk', 'milk', 'grädde', 'cream'];

export const NUTRIENT_KEYWORD_RULES: readonly NutrientKeywordRule[] = [
  {
    label: 'red meat',
    stems: [
      'nötfärs', 'nötkött', 'nötstek', 'nötbog', 'nötbringa', 'högrev', 'entrecote',
      'oxfilé', 'ryggbiff', 'rostbiff', 'biffstek', 'oxbiff', 'rumpbiff', 'fransyska',
      'köttfärs', 'lammfärs', 'lammkött', 'lammstek', 'lammfilé',
      'lammkotlett', 'lammskank', 'älgfärs', 'älgkött', 'älgstek', 'hjortfärs',
      'hjortkött', 'rådjur', 'renskav', 'renkött', 'viltfärs', 'grytbitar', 'kalvfärs',
    ],
    words: ['biff', 'biffar', 'beef', 'steak', 'steaks', 'lamb', 'venison', 'veal', 'brisket', 'sirloin'],
    phrases: ['ground beef', 'minced beef'],
    // Lamb's lettuce ("lammsallad") and meat-free mince
    exclude: [...STOCK, 'lettuce', 'lammsallad', 'vego', 'veget', 'vegan', 'soja', 'soy', 'växtbaser', 'plant-based', 'quorn'],
    nutrients: ['iron', 'zinc', 'protein', 'vitamin-b6'],
  },
  {
    label: 'organ meat and blood foods',
    stems: ['hjärta', 'hjärtan', 'lever', 'njure', 'njurar', 'blodpudding', 'blodkorv'],
    words: ['liver', 'livers', 'heart', 'hearts'],
    exclude: [...STOCK, 'sallad', 'lettuce', 'romaine', 'kronärtskock', 'artichoke', 'palm', 'hemp', 'hampa'],
    nutrients: ['iron', 'zinc', 'protein', 'vitamin-b6'],
  },
  {
    label: 'poultry',
    stems: ['kyckling', 'kalkon', 'ankbröst', 'ankfilé', 'anklår'],
    words: ['anka', 'chicken', 'turkey', 'duck'],
    exclude: STOCK,
    nutrients: ['protein', 'vitamin-b6'],
  },
  {
    label: 'pork',
    stems: ['fläskfilé', 'fläskkarré', 'fläskkött', 'fläskfärs', 'fläskkotlett', 'fläskytterfilé', 'karré'],
    words: ['pork'],
    exclude: STOCK,
    nutrients: ['protein', 'vitamin-b6'],
  },
  {
    label: 'oily fish',
    stems: ['lax', 'makrill', 'sill', 'strömming', 'sardin', 'ansjovis', 'röding'],
    words: ['öring', 'salmon', 'mackerel', 'herring', 'sardine', 'sardines', 'anchovy', 'anchovies', 'trout'],
    // "flax" hides "lax"
    exclude: [...STOCK, 'flax'],
    nutrients: ['omega-3', 'protein', 'vitamin-b6'],
  },
  {
    label: 'white fish',
    stems: ['torsk', 'sejfilé', 'kolja', 'gösfilé', 'hälleflundra', 'spätta', 'tonfisk', 'fiskfilé', 'vitfisk', 'kummel', 'abborre'],
    words: ['sej', 'gös', 'fisk', 'cod', 'haddock', 'pollock', 'tuna', 'fish', 'halibut', 'plaice', 'perch', 'tilapia'],
    // fish sauce and fish stock are seasonings
    exclude: [...STOCK, 'sås', 'sauce'],
    nutrients: ['protein'],
  },
  {
    label: 'shrimp and lobster',
    stems: ['räkor', 'räka', 'hummer', 'kräft'],
    words: ['shrimp', 'shrimps', 'prawn', 'prawns', 'lobster', 'crayfish'],
    exclude: STOCK,
    nutrients: ['protein'],
  },
  {
    label: 'mussels and clams',
    stems: ['musslor', 'mussla', 'vongole'],
    words: ['mussel', 'mussels', 'clam', 'clams'],
    exclude: STOCK,
    nutrients: ['protein', 'iron'],
  },
  {
    label: 'oysters and crab',
    stems: ['ostron', 'krabb'],
    words: ['oyster', 'oysters', 'crab'],
    exclude: STOCK,
    nutrients: ['protein', 'zinc'],
  },
  {
    label: 'eggs',
    prefixes: ['ägg'],
    words: ['egg', 'eggs', 'yolk', 'yolks'],
    exclude: ['eggplant', 'äggfri', 'äggersättning', 'egg-free', 'egg replacer'],
    nutrients: ['protein'],
  },
  {
    label: 'high-protein dairy',
    stems: ['kvarg', 'keso', 'kesella', 'skyr', 'halloumi'],
    words: ['quark'],
    phrases: ['grekisk yoghurt', 'turkisk yoghurt', 'greek yogurt', 'greek yoghurt', 'cottage cheese'],
    nutrients: ['protein', 'calcium'],
  },
  {
    label: 'milk, yogurt and cheese',
    stems: ['yoghurt', 'filmjölk', 'mjölk', 'parmesan', 'cheddar', 'mozzarella', 'feta', 'gruyère'],
    // "ost", "getost", "fetaost", "prästost"
    suffixes: ['ost', 'ostar'],
    words: ['milk', 'yogurt', 'yoghurt', 'cheese'],
    // Plant drinks, milk chocolate and "äppelmost" (apple juice)
    exclude: ['kokos', 'coconut', 'havre', 'oat', 'mandel', 'almond', 'soja', 'soy', 'ris', 'rice', 'cashew', 'växt', 'dryck', 'drink', 'choklad', 'chocolate', 'mjölkfri', 'dairy-free', 'most'],
    nutrients: ['calcium'],
  },
  {
    label: 'beans, lentils and chickpeas',
    stems: ['bönor', 'böna', 'kikärt', 'edamame', 'mungbön', 'hummus'],
    // "linser", "linsgryta", "linspasta" (but not "linfrön")
    prefixes: ['lins'],
    words: ['bean', 'beans', 'lentil', 'lentils', 'chickpea', 'chickpeas', 'garbanzo', 'garbanzos', 'legumes'],
    phrases: ['gula ärtor', 'split peas'],
    exclude: ['kaffe', 'coffee', 'kakao', 'cocoa', 'vanilj', 'vanilla', 'jelly', 'brytbön', 'haricot', 'vaxbön', 'gröna bönor', 'green beans', 'string beans'],
    nutrients: ['protein', 'fiber', 'complex-carbs', 'iron'],
  },
  {
    label: 'black beans',
    phrases: ['svarta bönor', 'black beans'],
    nutrients: ['magnesium'],
  },
  {
    label: 'tofu',
    stems: ['tofu'],
    nutrients: ['protein', 'iron', 'calcium'],
  },
  {
    label: 'tempeh',
    stems: ['tempeh'],
    nutrients: ['protein', 'iron', 'magnesium'],
  },
  {
    label: 'seitan',
    stems: ['seitan'],
    nutrients: ['protein'],
  },
  {
    label: 'spinach and chard',
    stems: ['spenat', 'mangold'],
    words: ['spinach', 'chard'],
    nutrients: ['iron', 'magnesium'],
  },
  {
    label: 'kale and cabbages',
    stems: ['grönkål', 'svartkål', 'rödkål', 'brysselkål', 'blomkål', 'broccoli', 'vitkål', 'spetskål', 'savojkål'],
    words: ['kale', 'cabbage', 'cauliflower', 'broccolini'],
    phrases: ['brussels sprouts', 'cavolo nero'],
    nutrients: ['vitamin-c', 'fiber'],
  },
  {
    label: 'kale',
    stems: ['grönkål', 'svartkål'],
    words: ['kale'],
    phrases: ['cavolo nero'],
    nutrients: ['antioxidants', 'calcium'],
  },
  {
    label: 'red cabbage',
    stems: ['rödkål'],
    phrases: ['red cabbage'],
    nutrients: ['antioxidants'],
  },
  {
    label: 'green peas',
    // Whole words only: not "ärtskott" (pea shoots) or "sockerärtor" (sugar snaps)
    words: ['ärtor', 'ärter', 'peas'],
    exclude: ['sockerärt', 'snap', 'snow'],
    nutrients: ['protein', 'fiber'],
  },
  {
    label: 'peppers and vitamin C fruit',
    stems: ['paprika', 'kiwi', 'jordgubb', 'svartvinbär', 'havtorn', 'apelsin', 'grapefrukt', 'mango', 'ananas', 'papaya'],
    words: ['capsicum', 'orange', 'oranges', 'strawberry', 'strawberries', 'blackcurrant', 'blackcurrants', 'grapefruit', 'pineapple'],
    phrases: ['bell pepper', 'bell peppers', 'red pepper', 'red peppers', 'sea buckthorn'],
    // Spice powder, zest and a squeeze of juice are seasoning amounts
    exclude: ['pulver', 'powder', 'krydda', 'rökt', 'smoked', 'zest', 'skal', 'peel', 'rind', 'saft', 'juice', 'pressad', 'squeezed', 'marmelad', 'marmalade', 'sylt', 'jam'],
    nutrients: ['vitamin-c'],
  },
  {
    label: 'berries',
    stems: ['bär', 'hallon', 'jordgubb', 'lingon', 'aronia', 'acai', 'granatäpple'],
    words: ['berry', 'berries', 'blueberries', 'raspberries', 'strawberries', 'blackberries', 'cranberries', 'lingonberries', 'pomegranate'],
    // Jam, cordial and cherry tomatoes ("körsbärstomater")
    exclude: ['sylt', 'jam', 'saft', 'juice', 'cordial', 'marmelad', 'tomat', 'tomato', 'gelé', 'jelly'],
    nutrients: ['antioxidants', 'fiber'],
  },
  {
    label: 'beetroot and tomatoes',
    stems: ['rödbet', 'passata'],
    words: ['beetroot', 'beetroots', 'beets'],
    phrases: ['passerade tomater', 'krossade tomater', 'crushed tomatoes', 'chopped tomatoes'],
    exclude: ['puré', 'pure', 'paste', 'ketchup', 'saft', 'juice'],
    nutrients: ['antioxidants'],
  },
  {
    label: 'pumpkin seeds',
    stems: ['pumpafrö', 'pumpakärn'],
    words: ['pepitas'],
    phrases: ['pumpkin seeds', 'pumpkin seed'],
    exclude: OILS,
    nutrients: ['magnesium', 'zinc', 'iron', 'protein', 'fiber'],
  },
  {
    label: 'sunflower seeds',
    stems: ['solrosfrö', 'solroskärn'],
    phrases: ['sunflower seeds', 'sunflower seed'],
    exclude: OILS,
    nutrients: ['magnesium', 'vitamin-b6', 'fiber'],
  },
  {
    label: 'sesame and tahini',
    stems: ['sesam', 'tahini'],
    words: ['sesame'],
    exclude: OILS,
    nutrients: ['calcium', 'iron', 'magnesium', 'zinc'],
  },
  {
    label: 'flaxseed and chia',
    stems: ['linfrö', 'chia'],
    words: ['flax', 'flaxseed', 'flaxseeds', 'linseed', 'linseeds'],
    exclude: OILS,
    nutrients: ['omega-3', 'fiber', 'magnesium'],
  },
  {
    label: 'hemp seeds',
    stems: ['hampafrö', 'hampfrö'],
    phrases: ['hemp seeds', 'hemp hearts'],
    exclude: OILS,
    nutrients: ['omega-3', 'protein', 'magnesium', 'zinc'],
  },
  {
    label: 'psyllium',
    stems: ['psyllium', 'loppfrö'],
    nutrients: ['fiber'],
  },
  {
    label: 'almonds',
    stems: ['mandel', 'mandlar'],
    words: ['almond', 'almonds'],
    exclude: [...PLANT_DRINKS, ...OILS, 'essens', 'extract', 'arom', 'massa', 'likör'],
    nutrients: ['magnesium', 'calcium', 'fiber'],
  },
  {
    label: 'cashews',
    stems: ['cashew'],
    exclude: [...PLANT_DRINKS, ...OILS],
    nutrients: ['magnesium', 'zinc', 'iron'],
  },
  {
    label: 'walnuts',
    stems: ['valnöt'],
    words: ['walnut', 'walnuts'],
    exclude: OILS,
    nutrients: ['omega-3', 'magnesium'],
  },
  {
    label: 'other nuts',
    stems: ['hasselnöt', 'paranöt', 'pekannöt', 'nötter', 'nötmix', 'nötsmör', 'pinjenöt', 'pistage', 'pistasch'],
    words: ['nuts', 'hazelnut', 'hazelnuts', 'pecan', 'pecans', 'pistachio', 'pistachios'],
    phrases: ['brazil nuts', 'pine nuts'],
    exclude: [...PLANT_DRINKS, ...OILS, 'kokos', 'coconut', 'muskot', 'nutmeg'],
    nutrients: ['magnesium', 'fiber'],
  },
  {
    label: 'peanuts',
    stems: ['jordnöt'],
    words: ['peanut', 'peanuts'],
    exclude: OILS,
    nutrients: ['protein', 'magnesium'],
  },
  {
    label: 'oats',
    stems: ['havre'],
    words: ['oat', 'oats', 'oatmeal'],
    exclude: [...PLANT_DRINKS, 'fraiche', 'yoghurt', 'yogurt', 'glass'],
    nutrients: ['complex-carbs', 'fiber', 'magnesium'],
  },
  {
    label: 'whole grains',
    stems: ['fullkorn', 'grahamsmjöl', 'råris', 'vildris', 'bovete', 'teff', 'hirs', 'amarant', 'korngryn', 'kornflingor', 'pärlkorn'],
    words: ['korn', 'matkorn', 'wholegrain', 'wholemeal', 'buckwheat', 'millet', 'amaranth', 'barley', 'teff'],
    phrases: ['brunt ris', 'whole grain', 'whole wheat', 'brown rice', 'wild rice'],
    nutrients: ['complex-carbs', 'fiber', 'magnesium'],
  },
  {
    label: 'teff',
    stems: ['teff'],
    words: ['teff'],
    nutrients: ['iron', 'calcium'],
  },
  {
    label: 'rye and spelt',
    stems: ['råg', 'dinkel', 'speltmjöl'],
    words: ['rye', 'spelt'],
    nutrients: ['complex-carbs', 'fiber'],
  },
  {
    label: 'quinoa',
    stems: ['quinoa', 'kinoa'],
    nutrients: ['complex-carbs', 'protein', 'fiber', 'magnesium', 'iron'],
  },
  {
    label: 'sweet potato',
    stems: ['sötpotatis'],
    phrases: ['sweet potato', 'sweet potatoes'],
    words: ['yam', 'yams'],
    exclude: ['chips', 'crisps', 'pommes', 'fries'],
    nutrients: ['complex-carbs', 'vitamin-b6', 'antioxidants'],
  },
  {
    label: 'potatoes',
    stems: ['potatis'],
    words: ['potato', 'potatoes'],
    // Potato starch/flour and crisps are not potatoes in a nutritional sense
    exclude: ['mjöl', 'stärkelse', 'starch', 'flour', 'chips', 'crisps', 'flingor', 'flakes'],
    nutrients: ['vitamin-b6'],
  },
  {
    label: 'bananas',
    stems: ['banan'],
    words: ['banana', 'bananas'],
    exclude: ['chips', 'schalott', 'shallot'],
    nutrients: ['vitamin-b6'],
  },
  {
    label: 'avocado',
    stems: ['avokado'],
    words: ['avocado', 'avocados'],
    exclude: OILS,
    nutrients: ['fiber', 'vitamin-b6'],
  },
  {
    label: 'dates, figs and prunes',
    stems: ['dadlar', 'dadel', 'medjool', 'fikon', 'katrinplommon'],
    words: ['dates', 'figs', 'prunes'],
    exclude: ['sirap', 'syrup'],
    nutrients: ['fiber'],
  },
  {
    label: 'cocoa and dark chocolate',
    stems: ['kakao', 'bakchoklad', 'råkakao'],
    words: ['cocoa', 'cacao'],
    phrases: ['mörk choklad', 'dark chocolate'],
    // Cocoa butter is just fat
    exclude: ['kakaosmör', 'cocoa butter', 'cacao butter', 'dryck', 'drink'],
    nutrients: ['magnesium', 'iron', 'antioxidants'],
  },
];

/**
 * Seasoning-sized amounts (a teaspoon of cocoa to dust, a pinch of seeds) do not make a
 * dish a source of anything. Tablespoons still count: two tablespoons of chia or tahini
 * is a real amount.
 */
const TRACE_UNITS = new Set([
  'tsk', 'tsp', 'teaspoon', 'teaspoons', 'krm', 'nypa', 'pinch', 'knivsudd', 'droppe',
  'droppar', 'drop', 'drops', 'dash',
]);

function tokenize(name: string): string[] {
  return name
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

function matchesRule(rule: NutrientKeywordRule, tokens: string[], joined: string, raw: string): boolean {
  if (rule.exclude?.some((term) => raw.includes(term))) return false;
  if (rule.stems?.some((stem) => tokens.some((token) => token.includes(stem)))) return true;
  if (rule.prefixes?.some((prefix) => tokens.some((token) => token.startsWith(prefix)))) {
    return true;
  }
  if (rule.suffixes?.some((suffix) => tokens.some((token) => token.endsWith(suffix)))) {
    return true;
  }
  if (rule.words?.some((word) => tokens.includes(word))) return true;
  return Boolean(rule.phrases?.some((phrase) => ` ${joined} `.includes(` ${phrase} `)));
}

export interface IngredientForInference {
  name: string;
  unit?: string | null;
}

/** Nutrients one ingredient is a good source of (empty for unknown or trace amounts). */
export function inferIngredientNutrients(
  ingredient: IngredientForInference
): NutrientHighlight[] {
  const unit = ingredient.unit?.trim().toLowerCase();
  if (unit && TRACE_UNITS.has(unit)) return [];
  const raw = ingredient.name.normalize('NFC').toLowerCase();
  const tokens = tokenize(raw);
  if (tokens.length === 0) return [];
  const joined = tokens.join(' ');
  const found = new Set<NutrientHighlight>();
  for (const rule of NUTRIENT_KEYWORD_RULES) {
    if (matchesRule(rule, tokens, joined, raw)) {
      rule.nutrients.forEach((nutrient) => found.add(nutrient));
    }
  }
  return inVocabularyOrder(NUTRIENT_HIGHLIGHTS, [...found]);
}

/** Nutrient highlights for a recipe, worked out from its ingredient names. */
export function inferNutrientHighlights(
  ingredients: readonly IngredientForInference[]
): NutrientHighlight[] {
  const found = new Set<NutrientHighlight>();
  for (const ingredient of ingredients) {
    inferIngredientNutrients(ingredient).forEach((nutrient) => found.add(nutrient));
  }
  return inVocabularyOrder(NUTRIENT_HIGHLIGHTS, [...found]);
}

/** Phases whose focus nutrients the recipe provides. */
export function derivePhaseTags(nutrients: readonly NutrientHighlight[]): CyclePhase[] {
  const set = new Set(nutrients);
  return CYCLE_PHASES.filter((phase) =>
    PHASE_NUTRITION[phase].focus.some((nutrient) => set.has(nutrient))
  );
}

// ---------------------------------------------------------------------------
// Recipe profiles and matches
// ---------------------------------------------------------------------------

export interface RecipeBioInput {
  phaseTags?: readonly string[] | null;
  nutrientHighlights?: readonly string[] | null;
  ingredients?: readonly IngredientForInference[] | null;
  leanRole?: string | null;
}

export interface RecipeBioProfile {
  phases: CyclePhase[];
  nutrients: NutrientHighlight[];
}

/**
 * LEAN roles whose phases come only from explicit tags. Treats and building blocks
 * (Process: sauces, dressings, spice mixes) are eaten in small amounts or as part of
 * another dish: a few eggs in a lemon meringue pie or peanut butter in a sauce should
 * not make them a "Biological Match". Tag one yourself when it really fits (e.g. dark
 * chocolate for the luteal phase).
 */
export const EXPLICIT_PHASES_ONLY_ROLES = ['Treat', 'Process'] as const;

function needsExplicitPhases(leanRole: string | null | undefined): boolean {
  const role = normalizeLeanRole(leanRole);
  return role !== null && (EXPLICIT_PHASES_ONLY_ROLES as readonly string[]).includes(role);
}

/**
 * Explicit tags on the recipe win. Empty lists fall back to inference: nutrients from
 * ingredient names, phases from the nutrients (not for EXPLICIT_PHASES_ONLY_ROLES, unless
 * their nutrients were set explicitly).
 */
export function resolveRecipeBioProfile(recipe: RecipeBioInput): RecipeBioProfile {
  const explicitNutrients = sanitizeNutrientHighlights(recipe.nutrientHighlights);
  const nutrients =
    explicitNutrients.length > 0
      ? explicitNutrients
      : inferNutrientHighlights(recipe.ingredients ?? []);
  const explicitPhases = sanitizePhaseTags(recipe.phaseTags);
  if (explicitPhases.length > 0) return { phases: explicitPhases, nutrients };
  const inferredOnly = explicitNutrients.length === 0 && needsExplicitPhases(recipe.leanRole);
  return { phases: inferredOnly ? [] : derivePhaseTags(nutrients), nutrients };
}

export interface BiologicalMatch {
  phase: CyclePhase;
  /** The recipe's nutrients that matter for this phase, focus nutrients first. */
  nutrients: NutrientHighlight[];
  /** Focus nutrients covered (at least 1 for an explicitly tagged recipe). */
  strength: number;
}

/** Null unless the recipe is tagged (or inferred) for the given phase. */
export function getBiologicalMatch(
  profile: RecipeBioProfile | null | undefined,
  phase: CyclePhase | null | undefined
): BiologicalMatch | null {
  if (!profile || !phase || !profile.phases.includes(phase)) return null;
  const { focus, supporting } = PHASE_NUTRITION[phase];
  const has = new Set(profile.nutrients);
  const focusHits = focus.filter((nutrient) => has.has(nutrient));
  const supportingHits = supporting.filter((nutrient) => has.has(nutrient));
  return {
    phase,
    nutrients: [...focusHits, ...supportingHits],
    strength: Math.max(1, focusHits.length),
  };
}

/** Tooltip text for a Biological Match badge. */
export function describeBiologicalMatch(match: BiologicalMatch): string {
  const phase = PHASE_LABELS[match.phase].toLowerCase();
  const nutrients = match.nutrients.length
    ? ` It brings ${formatNutrientList(match.nutrients)}.`
    : '';
  return `Suits your ${phase} phase.${nutrients} ${PHASE_NUTRITION[match.phase].benefit}`;
}
