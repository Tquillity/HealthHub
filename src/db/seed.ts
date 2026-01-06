// Load environment variables FIRST - use dotenv/config side-effect import
import 'dotenv/config';

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { hashPassword } from 'better-auth/crypto';
// @ts-ignore - Prisma Client types may not be recognized by TS server immediately after regeneration
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface KitchenManifestRecipe {
  name: string;
  description?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  category?: string;
  tags?: string[];
  difficulty?: string;
  cuisine?: string;
  dietaryTags?: string[];
  videoUrl?: string;
  isSecret?: boolean; // Only MAIN admin can see secret recipes
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    notes?: string;
    melted?: boolean;
  }>;
  instructions: Array<{
    stepNumber: number;
    text: string;
  }>;
}

interface KitchenManifestRoutine {
  name: string;
  description?: string;
  category?: string;
  frequency: string;
}

interface KitchenManifest {
  recipes: KitchenManifestRecipe[];
  routines?: KitchenManifestRoutine[];
  deletedRecipes?: string[]; // Recipe names that should never be seeded (user-deleted)
}

async function seed() {
  console.log('🌱 Starting database seed...');
  
  /**
   * For local scripts (Node.js runtime), we use the standard PostgreSQL adapter.
   * Prisma 7 requires an adapter when driverAdapters is enabled in the schema.
   * The Serverless Adapter (Neon) is primarily for the Next.js runtime (Vercel/Edge).
   */
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set in your .env file');
    process.exit(1);
  }

  // Create a standard PostgreSQL pool for local scripts
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  try {
    // 1. Verify Connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');

    // 2. Seed Admin User
    console.log('👤 Seeding admin user...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@healthhub.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const adminName = process.env.ADMIN_NAME || 'Admin User';

    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    // Better-Auth expects its own password hash format (scrypt: "salt:hexkey")
    const hashedPassword = await hashPassword(adminPassword);

    const adminUser =
      existingAdmin ??
      (await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          emailVerified: true,
          role: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }));

    if (existingAdmin) {
      console.log(`⚠️ Admin user already exists: ${adminEmail} (repairing password hash if needed)`);
    }

    /**
     * Ensure credential account exists AND has a valid Better-Auth password hash.
     * We force-replace any existing credential accounts to avoid duplicates
     * (Better-Auth may read the "wrong" one if multiple exist).
     */
    await prisma.account.deleteMany({
      where: {
        userId: adminUser.id,
        providerId: 'credential',
      },
    });

    await prisma.account.create({
      data: {
        id: `account_${adminUser.id}`,
        userId: adminUser.id,
        accountId: adminUser.id,
        providerId: 'credential',
        password: hashedPassword,
      },
    });

    // Ensure default org + membership exist (safe on re-run)
    const defaultOrgId = `org_${adminUser.id}`;
    const defaultMemberId = `member_${adminUser.id}`;
    const defaultSlug = `admin-household`;

    // Check by slug first (since slug has unique constraint)
    let existingOrg = await prisma.organization.findUnique({
      where: { slug: defaultSlug },
    });

    // If not found by slug, check by id
    if (!existingOrg) {
      existingOrg = await prisma.organization.findUnique({
        where: { id: defaultOrgId },
      });
    }

    const defaultOrg =
      existingOrg ??
      (await prisma.organization.create({
        data: {
          id: defaultOrgId,
          name: `${adminName}'s Household`,
          slug: defaultSlug,
          createdAt: new Date(),
        },
      }));

    const existingMember = await prisma.member.findUnique({
      where: { id: defaultMemberId },
    });

    if (!existingMember) {
      await prisma.member.create({
        data: {
          id: defaultMemberId,
          organizationId: defaultOrg.id,
          userId: adminUser.id,
          role: 'owner',
          createdAt: new Date(),
        },
      });
    }

    console.log(`✅ Admin credentials ready`);
    console.log(`\n  📧 ADMIN CREDENTIALS:`);
    console.log(`     Email: ${adminEmail}`);
    console.log(`     Password: ${adminPassword}`);
    console.log(`\n  ⚠️  Save these credentials - you'll need them to sign in!\n`);

    // 3. Load and Seed Recipes
    const manifestPath = path.join(__dirname, 'kitchen-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as KitchenManifest;

    console.log(`📝 Seeding recipes from manifest...`);
    const deletedRecipes = new Set(manifest.deletedRecipes || []);
    
    // First, delete all existing system recipes to ensure clean state
    // This removes any recipes that were deleted by the user
    const deletedCount = await prisma.recipe.deleteMany({
      where: { isSystem: true },
    });
    console.log(`  🗑️  Deleted ${deletedCount.count} existing system recipes`);
    
    // Now seed all recipes from the manifest (except deleted ones)
    let seededCount = 0;
    let skippedCount = 0;
    
    for (const recipeData of manifest.recipes) {
      // Skip recipes that have been deleted by the user
      if (deletedRecipes.has(recipeData.name)) {
        console.log(`  🚫 Skipping deleted recipe: ${recipeData.name}`);
        skippedCount++;
        continue;
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Prepare recipe data with explicit typing to avoid TypeScript cache issues
        const recipeDataInput = {
          name: recipeData.name,
          description: recipeData.description || null,
          imageUrl: null,
          videoUrl: recipeData.videoUrl || null, // Video tutorial URL
          prepTime: recipeData.prepTime || null,
          cookTime: recipeData.cookTime || null,
          servings: recipeData.servings || null,
          category: recipeData.category || null,
          tags: recipeData.tags || [],
          difficulty: recipeData.difficulty || null,
          cuisine: recipeData.cuisine || null,
          dietaryTags: recipeData.dietaryTags || [],
          leanRole: (recipeData as any).leanInfo?.leanRole || (recipeData as any).lean_metrics?.lean_role || null, // Map leanRole from leanInfo (camelCase) or lean_metrics (snake_case)
          isSystem: true,
          isSecret: recipeData.isSecret || false, // Secret recipes only visible to MAIN admin
          isPrivate: false, // System recipes are never private
          organizationId: null,
        } as const;
        
        const recipe = await tx.recipe.create({
          data: recipeDataInput,
        });

        await tx.ingredient.createMany({
          data: recipeData.ingredients.map(ing => ({
            recipeId: recipe.id,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes || null,
          })),
        });

        await tx.instruction.createMany({
          data: recipeData.instructions.map(inst => ({
            recipeId: recipe.id,
            stepNumber: inst.stepNumber,
            text: inst.text,
          })),
        });
      });
      console.log(`  ✅ Recipe: ${recipeData.name}`);
      seededCount++;
    }
    
    console.log(`\n📊 Recipe seeding summary:`);
    console.log(`   ✅ Seeded: ${seededCount} recipes`);
    console.log(`   🚫 Skipped (deleted): ${skippedCount} recipes`);
    console.log(`   📝 Total in manifest: ${manifest.recipes.length} recipes`);

    // 4. Seed Routines
    if (manifest.routines && manifest.routines.length > 0) {
      console.log(`🏃 Seeding ${manifest.routines.length} routines...`);
      for (const routineData of manifest.routines) {
        // Check if routine exists to avoid duplicates on re-run
        const existingRoutine = await prisma.routine.findFirst({ where: { name: routineData.name }});
        if (existingRoutine) {
          console.log(`  ⏭️  Routine already exists: ${routineData.name}`);
          continue;
        }

        await prisma.routine.create({
          data: {
            name: routineData.name,
            description: routineData.description || null,
            category: routineData.category || null,
            frequency: routineData.frequency,
            isSystem: true,
            organizationId: null,
          },
        });
        console.log(`  ✅ Routine: ${routineData.name}`);
      }
    }

        // 5. Seed Educational Resources (Complete data from original MERN stack)
        const educationalResources = [
          {
            title: 'The Complete Guide to Mindful Eating',
            content: `
              <h2>What is Mindful Eating?</h2>
              <p>Mindful eating is the practice of being fully present and aware during meals. It involves paying attention to the colors, smells, flavors, and textures of your food, as well as your body's hunger and satiety cues.</p>
              
              <h3>Benefits of Mindful Eating</h3>
              <ul>
                <li>Improved digestion</li>
                <li>Better portion control</li>
                <li>Reduced emotional eating</li>
                <li>Increased satisfaction with meals</li>
                <li>Better relationship with food</li>
              </ul>
              
              <h3>How to Practice Mindful Eating</h3>
              <ol>
                <li>Eat without distractions (no TV, phone, or computer)</li>
                <li>Chew slowly and thoroughly</li>
                <li>Pay attention to hunger and fullness cues</li>
                <li>Notice the colors, smells, and textures of your food</li>
                <li>Express gratitude for your meal</li>
              </ol>
              
              <h3>Getting Started</h3>
              <p>Start with one meal per day. Choose a quiet time when you can focus entirely on eating. Begin by taking three deep breaths before your first bite, and commit to eating without any distractions.</p>
            `,
            excerpt: 'Learn how to develop a healthier relationship with food through mindful eating practices that improve digestion, portion control, and overall satisfaction.',
            category: 'nutrition',
            tags: ['mindful eating', 'digestion', 'portion control', 'wellness'],
            difficulty: 'beginner',
            readTime: 8,
            imageUrl: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=400&fit=crop',
            featured: true,
          },
          {
            title: '5-Minute Morning Meditation Routine',
            content: `
              <h2>Start Your Day with Intention</h2>
              <p>This simple 5-minute morning meditation routine will help you start your day with clarity, focus, and inner peace. Perfect for beginners and busy schedules.</p>
              
              <h3>The Routine</h3>
              <ol>
                <li><strong>Minute 1:</strong> Find a comfortable seated position and close your eyes</li>
                <li><strong>Minute 2:</strong> Take 10 deep breaths, focusing on the rise and fall of your chest</li>
                <li><strong>Minute 3:</strong> Body scan from head to toe, releasing any tension</li>
                <li><strong>Minute 4:</strong> Set an intention for your day</li>
                <li><strong>Minute 5:</strong> Slowly open your eyes and take three more deep breaths</li>
              </ol>
              
              <h3>Tips for Success</h3>
              <ul>
                <li>Choose a consistent time each morning</li>
                <li>Use a comfortable cushion or chair</li>
                <li>Don't judge your thoughts - just observe them</li>
                <li>Start with 2-3 minutes if 5 feels too long</li>
              </ul>
              
              <h3>Benefits</h3>
              <p>Regular morning meditation can reduce stress, improve focus, increase emotional regulation, and set a positive tone for your entire day.</p>
            `,
            excerpt: 'A simple 5-minute morning meditation routine to start your day with clarity, focus, and inner peace. Perfect for beginners.',
            category: 'wellness',
            tags: ['meditation', 'morning routine', 'mindfulness', 'stress relief'],
            difficulty: 'beginner',
            readTime: 5,
            imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
            featured: true,
          },
          {
            title: 'Understanding Your Circadian Rhythm for Better Sleep',
            content: `
              <h2>What is Circadian Rhythm?</h2>
              <p>Your circadian rhythm is your body's internal 24-hour clock that regulates sleep-wake cycles, hormone production, and other physiological processes. Understanding and working with this natural rhythm can dramatically improve your sleep quality.</p>
              
              <h3>How Circadian Rhythm Works</h3>
              <p>The suprachiasmatic nucleus (SCN) in your brain acts as the master clock, responding to light and dark signals to regulate melatonin production. When it's dark, your body produces melatonin, making you sleepy. When it's light, melatonin production stops, making you alert.</p>
              
              <h3>Tips to Align with Your Circadian Rhythm</h3>
              <ul>
                <li><strong>Morning Light:</strong> Get 10-30 minutes of natural sunlight within an hour of waking</li>
                <li><strong>Consistent Sleep Schedule:</strong> Go to bed and wake up at the same time every day</li>
                <li><strong>Evening Wind-Down:</strong> Dim lights 2-3 hours before bed</li>
                <li><strong>Blue Light Management:</strong> Avoid screens 1 hour before bed or use blue light filters</li>
                <li><strong>Temperature:</strong> Keep your bedroom cool (65-68°F) for optimal sleep</li>
              </ul>
              
              <h3>Signs Your Circadian Rhythm is Off</h3>
              <ul>
                <li>Difficulty falling asleep or waking up</li>
                <li>Feeling tired during the day</li>
                <li>Irregular sleep patterns</li>
                <li>Mood changes or irritability</li>
              </ul>
            `,
            excerpt: "Learn how your body's internal clock affects sleep and discover practical strategies to align with your natural circadian rhythm for better rest.",
            category: 'sleep',
            tags: ['circadian rhythm', 'sleep hygiene', 'melatonin', 'sleep schedule'],
            difficulty: 'intermediate',
            readTime: 12,
            imageUrl: 'https://images.unsplash.com/photo-1541781774459-1dcf1b4b0b8e?w=800&h=400&fit=crop',
            featured: true,
          },
          {
            title: 'Stress Management Through Deep Breathing Techniques',
            content: `
              <h2>The Power of Breath</h2>
              <p>Breathing is the only autonomic function we can consciously control. By learning specific breathing techniques, you can activate your parasympathetic nervous system and reduce stress in real-time.</p>
              
              <h3>4-7-8 Breathing Technique</h3>
              <ol>
                <li>Inhale through your nose for 4 counts</li>
                <li>Hold your breath for 7 counts</li>
                <li>Exhale through your mouth for 8 counts</li>
                <li>Repeat 4-8 cycles</li>
              </ol>
              
              <h3>Box Breathing (4-4-4-4)</h3>
              <ol>
                <li>Inhale for 4 counts</li>
                <li>Hold for 4 counts</li>
                <li>Exhale for 4 counts</li>
                <li>Hold empty for 4 counts</li>
                <li>Repeat for 5-10 minutes</li>
              </ol>
              
              <h3>Diaphragmatic Breathing</h3>
              <p>Also known as belly breathing, this technique engages your diaphragm and promotes relaxation:</p>
              <ol>
                <li>Place one hand on your chest, one on your belly</li>
                <li>Breathe so only your belly hand moves</li>
                <li>Inhale slowly through your nose</li>
                <li>Exhale slowly through your mouth</li>
              </ol>
              
              <h3>When to Use These Techniques</h3>
              <ul>
                <li>Before important meetings or presentations</li>
                <li>During stressful situations</li>
                <li>When feeling anxious or overwhelmed</li>
                <li>As part of your daily stress prevention routine</li>
              </ul>
            `,
            excerpt: 'Master powerful breathing techniques to manage stress in real-time. Learn the 4-7-8 method, box breathing, and diaphragmatic breathing for instant calm.',
            category: 'wellness',
            tags: ['breathing', 'stress relief', 'anxiety', 'relaxation'],
            difficulty: 'beginner',
            readTime: 7,
            imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=400&fit=crop',
            featured: false,
          },
          {
            title: 'Building a Sustainable Exercise Routine',
            content: `
              <h2>Why Most Exercise Routines Fail</h2>
              <p>The key to a successful exercise routine isn't intensity or duration—it's consistency. Most people fail because they start too aggressively and burn out quickly.</p>
              
              <h3>The 80/20 Rule for Exercise</h3>
              <p>80% of your results come from 20% of your effort. Focus on:</p>
              <ul>
                <li><strong>Consistency over intensity:</strong> 20 minutes daily beats 2 hours once a week</li>
                <li><strong>Progressive overload:</strong> Gradually increase difficulty</li>
                <li><strong>Recovery:</strong> Rest days are as important as workout days</li>
                <li><strong>Enjoyment:</strong> Choose activities you actually like</li>
              </ul>
              
              <h3>Building Your Routine</h3>
              <h4>Week 1-2: Foundation (10-15 minutes daily)</h4>
              <ul>
                <li>Walking or light cardio</li>
                <li>Basic bodyweight exercises</li>
                <li>Stretching and mobility</li>
              </ul>
              
              <h4>Week 3-4: Progression (15-20 minutes daily)</h4>
              <ul>
                <li>Increase intensity gradually</li>
                <li>Add resistance training</li>
                <li>Include variety</li>
              </ul>
              
              <h4>Month 2+: Optimization (20-30 minutes daily)</h4>
              <ul>
                <li>Structured workouts</li>
                <li>Specific goals</li>
                <li>Periodization</li>
              </ul>
              
              <h3>Tips for Long-term Success</h3>
              <ul>
                <li>Start with just 5 minutes if needed</li>
                <li>Schedule exercise like any other appointment</li>
                <li>Prepare workout clothes the night before</li>
                <li>Track your progress</li>
                <li>Celebrate small wins</li>
              </ul>
            `,
            excerpt: "Learn how to build a sustainable exercise routine that you'll actually stick to. Discover the 80/20 rule and progressive approach to fitness.",
            category: 'wellness',
            tags: ['fitness', 'routine', 'sustainability', 'motivation'],
            difficulty: 'beginner',
            readTime: 10,
            imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=400&fit=crop',
            featured: false,
          },
          {
            title: 'Understanding Hormonal Health for Women',
            content: `
              <h2>The Complex World of Female Hormones</h2>
              <p>Women's health is deeply connected to hormonal balance throughout different life stages. Understanding these cycles can help you optimize your health, energy, and well-being.</p>
              
              <h3>Key Hormones and Their Functions</h3>
              <h4>Estrogen</h4>
              <ul>
                <li>Regulates menstrual cycle</li>
                <li>Maintains bone density</li>
                <li>Affects mood and energy</li>
                <li>Peaks during ovulation</li>
              </ul>
              
              <h4>Progesterone</h4>
              <ul>
                <li>Prepares body for pregnancy</li>
                <li>Promotes sleep and relaxation</li>
                <li>Balances estrogen effects</li>
                <li>Higher in luteal phase</li>
              </ul>
              
              <h4>Testosterone</h4>
              <ul>
                <li>Maintains muscle mass</li>
                <li>Supports bone health</li>
                <li>Affects libido and energy</li>
                <li>Peaks in early morning</li>
              </ul>
              
              <h3>Tracking Your Cycle</h3>
              <p>Understanding your menstrual cycle can help you:</p>
              <ul>
                <li>Optimize workout timing</li>
                <li>Plan important tasks</li>
                <li>Manage energy levels</li>
                <li>Identify hormonal imbalances</li>
              </ul>
              
              <h3>Signs of Hormonal Imbalance</h3>
              <ul>
                <li>Irregular periods</li>
                <li>Mood swings</li>
                <li>Weight changes</li>
                <li>Sleep disturbances</li>
                <li>Skin changes</li>
                <li>Low energy</li>
              </ul>
              
              <h3>Supporting Hormonal Health</h3>
              <ul>
                <li>Balanced nutrition with adequate protein and healthy fats</li>
                <li>Regular exercise (but not overtraining)</li>
                <li>Stress management</li>
                <li>Quality sleep</li>
                <li>Limiting alcohol and caffeine</li>
              </ul>
            `,
            excerpt: 'A comprehensive guide to understanding female hormones, menstrual cycles, and how to support hormonal health for optimal well-being.',
            category: 'wellness',
            tags: ['hormones', 'menstrual cycle', 'women\'s health', 'hormonal balance'],
            difficulty: 'intermediate',
            readTime: 15,
            imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=400&fit=crop',
            featured: true,
          },
          {
            title: 'Potatisens Vetenskap: Från stärkelse till perfekt puré',
            content: `
              <h2>Potatisens Kemiska Struktur</h2>
              <p>Potatis innehåller tre viktiga komponenter som påverkar konsistensen när den kokas: stärkelse, pektin och kalcium. Förståelsen av dessa komponenter är nyckeln till att skapa en perfekt potatispuré som tål uppvärmning utan att bli klistrig.</p>
              
              <h3>Stärkelse (Starch)</h3>
              <p>Stärkelse är potatisens huvudsakliga kolhydrat och finns i form av små granul. När potatisen värms upp, sväller stärkelsegranulerna och absorberar vatten. Om temperaturen blir för hög eller om potatisen kokas för länge, kan stärkelsen brytas ner och bilda en klistrig, gelatinös massa.</p>
              <ul>
                <li><strong>Amylos:</strong> En linjär molekyl som bildar en mer stabil gel</li>
                <li><strong>Amylopektin:</strong> En förgrenad molekyl som kan göra purén klistrig om den överkokas</li>
              </ul>
              
              <h3>Pektin och Cellväggar</h3>
              <p>Pektin är en polysackarid som finns i cellväggarna hos växter. I potatis fungerar pektin som ett "lim" som håller cellerna samman. När potatisen kokas, mjuknar pektinet och cellerna separeras, vilket gör potatisen mjuk.</p>
              <ul>
                <li><strong>Låg temperatur (65-70°C):</strong> Pektinet stärker cellväggarna och gör dem mer stabila</li>
                <li><strong>Hög temperatur (100°C):</strong> Pektinet bryts ner för mycket och cellerna kollapsar</li>
              </ul>
              
              <h3>Kalcium och Cellstabilitet</h3>
              <p>Kalciumjoner spelar en kritisk roll i att stabilisera cellväggarna. Kalcium binder till pektinmolekylerna och skapar en starkare struktur som tål uppvärmning bättre.</p>
              <ul>
                <li><strong>Kalcium-Pektin-Bindning:</strong> Skapar en mer stabil cellvägg som inte kollapsar lika lätt</li>
                <li><strong>Vattenhårdhet:</strong> Kalcium i kokvattnet kan hjälpa till att stärka cellväggarna</li>
              </ul>
              
              <h3>Varför Tvåstegsmetoden Fungerar</h3>
              <p>Mästerklass-receptet använder en tvåstegsmetod som utnyttjar dessa kemiska processer:</p>
              <ol>
                <li><strong>Första steget (65-70°C, 30 min):</strong> Vid denna temperatur stärks pektinet och cellväggarna stabiliseras med kalcium. Stärkelsegranulerna sväller långsamt utan att brytas ner.</li>
                <li><strong>Andra steget (kokning):</strong> Efter att cellväggarna har stabiliserats, kan potatisen kokas till mjukhet utan att cellerna kollapsar helt. Stärkelsen gelatiniserar kontrollerat.</li>
              </ol>
              
              <h3>Praktiska Tips</h3>
              <ul>
                <li><strong>Sköljning:</strong> Att skölja bort ytstärkelse förhindrar att den bildar en klistrig hinna</li>
                <li><strong>Temperaturkontroll:</strong> Håll strikt temperatur mellan 65-70°C i första steget</li>
                <li><strong>Kallning:</strong> Att kyla potatisen mellan stegen stoppar processen och låter cellväggarna "fixeras"</li>
                <li><strong>Ångning:</strong> Att låta potatisen ånga av torkar ytan och förhindrar vattenhaltig puré</li>
              </ul>
              
              <h3>Vetenskaplig Förklaring av Resultatet</h3>
              <p>Genom att följa denna metod skapas en puré där:</p>
              <ul>
                <li>Cellväggarna är stabiliserade och tål uppvärmning</li>
                <li>Stärkelsen är kontrollerat gelatiniserad utan att bli klistrig</li>
                <li>Pektinet har skapat en stabil struktur som inte kollapsar</li>
                <li>Resultatet är en silkeslen, krämig puré som kan värmas om utan att förlora konsistens</li>
              </ul>
            `,
            excerpt: 'Lär dig den kemiska vetenskapen bakom perfekt potatispuré. Förstå hur pektin, kalcium och stärkelse samverkar för att skapa en puré som tål uppvärmning utan att bli klistrig.',
            category: 'Köksskolan',
            tags: ['potatis', 'kemi', 'matlagningsteknik', 'vetenskap'],
            difficulty: 'advanced',
            readTime: 12,
            imageUrl: 'https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=800&h=400&fit=crop',
            featured: true,
          },
        ];

        console.log(`📚 Seeding ${educationalResources.length} educational resources...`);
        for (const resourceData of educationalResources) {
          const existing = await prisma.educationalResource.findFirst({
            where: { title: resourceData.title },
          });
          if (existing) {
            console.log(`  ⏭️  Resource already exists: ${resourceData.title}`);
            continue;
          }

          await prisma.educationalResource.create({
            data: resourceData,
          });
          console.log(`  ✅ Resource: ${resourceData.title}`);
        }

        console.log('✨ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seed();
