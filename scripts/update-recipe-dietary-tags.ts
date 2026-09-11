/**
 * One-off: populate recipe.dietaryTags from ingredient analysis.
 * Swedish tags match kitchen-manifest convention.
 *
 * Run: pnpm exec tsx scripts/update-recipe-dietary-tags.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Recipe name → dietaryTags (derived from DB ingredients + dietary references). */
const DIETARY_BY_RECIPE_NAME: Record<string, string[]> = {
  'Agats Tahinipraliner': [
    'Vegansk',
    'Glutenfri',
    'Mejerifri',
    'Växtbaserat',
    'Paleo',
  ],
  'Asiatisk marinad med krispig tofu och tempeh': [
    'Vegansk',
    'Mejerifri',
    'Växtbaserat',
    // Japansk sojasås contains wheat unless tamari — not tagged Glutenfri
  ],
  'Bananpannkaka (Enkel)': [
    'Glutenfri',
    'Vegetariskt',
    'Paleo',
    // ägg + smör: not vegan/dairy-free; mandelmjöl: not nut-free
  ],
  'Chocolate Chip Cookies (Raw/No-Bake)': [
    'Vegansk',
    'Glutenfri',
    'Mejerifri',
    'Växtbaserat',
    'Raw',
  ],
  'Citron- och Marängpaj': [
    'Vegetariskt',
    // vetemjöl, smör, ägg — not gluten-free, vegan, or dairy-free
  ],
  'Frisk ärtskottsdressing': [
    'Vegansk',
    'Glutenfri',
    'Mejerifri',
    'Paleo',
    'Raw',
  ],
  'Fröknäcke (Grundrecept)': [
    'Glutenfri',
    'Vegansk',
    'Mejerifri',
    'Växtbaserat',
    'Nötfritt',
  ],
  'Havrefrallor med russin (Batch)': [
    'Glutenfri',
    'Vegansk',
    'Mejerifri',
    'Växtbaserat',
    'Nötfritt',
  ],
  'Hälsosam Chokladtårta med Mocca- & Karamellfrosting': [
    'Vegansk',
    'Glutenfri',
    'Mejerifri',
    'Nötfritt',
    'Antiinflammatorisk',
    'Utan vitt socker',
  ],
  'Japanskt Risbröd (Blender-metoden)': [
    'Glutenfri',
    'Vegansk',
    'Mejerifri',
    'Växtbaserat',
  ],
  'Jordnötssås med Kokosmjölk': [
    'Vegetariskt',
    'Vegansk',
    'Mejerifri',
    'Växtbaserat',
    // soja (not tamari) — not gluten-free
  ],
  'Klassisk Pepparkakskrydda': [
    'Glutenfri',
    'Mejerifri',
    'Vegansk',
    'Växtbaserat',
    'Paleo',
    'AIP-vänlig',
    'Utan vitt socker',
  ],
  'Krämig Fisksoppa med Saffran (Mejerifri)': [
    'Glutenfri',
    'Mejerifri',
    // lax/torsk/räkor — not vegetarian; kokosgrädde replaces cream; smör for sauté only
  ],
  'Krämig Potatispuré (Mästerklass)': ['Vegetariskt', 'Glutenfri'],
  'Lafa – Glutenfritt tunnbröd på fullkornsris och quinoa': [
    'Glutenfri',
    'Vegansk',
    'Mejerifri',
    'Växtbaserat',
    'Nötfritt',
  ],
  'Långkokt Nöthjärta med rödvin och rotfrukter': [
    'Glutenfri',
    'Paleo',
    'Keto',
    'LCHF',
    'Nötfritt',
    // smör present — not dairy-free
  ],
  'Mejerifri zucchinilasagne': ['Glutenfri', 'Mejerifri', 'Paleo', 'LCHF'],
  'Nuoc Cham (Vietnamesisk Dipsås)': [
    'Glutenfri',
    // fisksås — not vegetarian/vegan (typical fish sauce is fish + salt)
  ],
  'Osannolikt God Raw Vegan Cheesecake': [
    'Vegetariskt',
    'Glutenfri',
    'Mejerifri',
    'Raw',
    // honung — not vegan per standard definition
  ],
  'Pepparkaksrutor med choklad och apelsin': [
    'Paleo',
    'Glutenfri',
    'Mejerifri',
    'Laktosfri',
    'Vegansk',
    'Raw',
    'Utan vitt socker',
  ],
  'Pinklax-sås med Stekt Potatis': [
    'Glutenfri',
    // lax, grädde, smör — not vegetarian or dairy-free
  ],
  'Sötpotatisrösti med Lingon': [
    'Paleo',
    'AIP-vänlig',
    'Glutenfri',
    'Mejerifri',
    'Vegetariskt',
    // honung — not vegan; sweet potato allowed on AIP (Healthline / Paleo Mom)
  ],
};

async function main() {
  const recipes = await prisma.recipe.findMany({
    select: { id: true, name: true, dietaryTags: true },
    orderBy: { name: 'asc' },
  });

  let updated = 0;
  for (const recipe of recipes) {
    const tags = DIETARY_BY_RECIPE_NAME[recipe.name];
    if (!tags) {
      console.warn(`⚠ No mapping for: ${recipe.name}`);
      continue;
    }

    const prev = [...recipe.dietaryTags].sort().join('|');
    const next = [...tags].sort().join('|');
    if (prev === next) {
      console.log(`✓ ${recipe.name} (unchanged)`);
      continue;
    }

    await prisma.recipe.update({
      where: { id: recipe.id },
      data: { dietaryTags: tags },
    });
    console.log(`↑ ${recipe.name}`);
    console.log(`  was: [${recipe.dietaryTags.join(', ')}]`);
    console.log(`  now: [${tags.join(', ')}]`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} of ${recipes.length} recipes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
