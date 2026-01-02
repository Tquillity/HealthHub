// Load environment variables FIRST - use dotenv/config side-effect import
import 'dotenv/config';

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { hashPassword } from 'better-auth/crypto';
import { PrismaClient } from '@prisma/client';
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
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@healthassist.com';
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

    const existingOrg = await prisma.organization.findUnique({
      where: { id: defaultOrgId },
    });

    const defaultOrg =
      existingOrg ??
      (await prisma.organization.create({
        data: {
          id: defaultOrgId,
          name: `${adminName}'s Household`,
          slug: `admin-household`,
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

    console.log(`📝 Seeding ${manifest.recipes.length} recipes...`);
    for (const recipeData of manifest.recipes) {
      // Check if recipe exists to avoid duplicates on re-run
      const existingRecipe = await prisma.recipe.findFirst({ where: { name: recipeData.name }});
      if (existingRecipe) {
        console.log(`  ⏭️  Recipe already exists: ${recipeData.name}`);
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const recipe = await tx.recipe.create({
          data: {
            name: recipeData.name,
            description: recipeData.description || null,
            prepTime: recipeData.prepTime || null,
            cookTime: recipeData.cookTime || null,
            servings: recipeData.servings || null,
            category: recipeData.category || null,
            tags: recipeData.tags || [],
            isSystem: true,
            organizationId: null,
          },
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
    }

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

        // 5. Seed Educational Resources
        const educationalResources = [
          {
            title: 'Understanding Macronutrients',
            content: `
              <h2>What are Macronutrients?</h2>
              <p>Macronutrients are the nutrients your body needs in large amounts: carbohydrates, proteins, and fats. Each plays a crucial role in maintaining your health.</p>
              
              <h3>Carbohydrates</h3>
              <p>Carbs are your body's primary energy source. They're found in foods like grains, fruits, and vegetables. Aim for complex carbs like whole grains for sustained energy.</p>
              
              <h3>Proteins</h3>
              <p>Proteins are essential for building and repairing tissues. Good sources include lean meats, fish, eggs, beans, and legumes.</p>
              
              <h3>Fats</h3>
              <p>Healthy fats support brain function and hormone production. Focus on unsaturated fats from sources like avocados, nuts, and olive oil.</p>
            `,
            excerpt: 'Learn about the three main macronutrients and how they fuel your body.',
            category: 'nutrition',
            tags: ['nutrition', 'basics', 'macros'],
            difficulty: 'beginner',
            readTime: 5,
            featured: true,
          },
          {
            title: 'The Science of Sleep',
            content: `
              <h2>Why Sleep Matters</h2>
              <p>Quality sleep is fundamental to your health. It affects everything from cognitive function to immune system strength.</p>
              
              <h3>Sleep Cycles</h3>
              <p>Your body goes through multiple sleep cycles each night, including REM (rapid eye movement) and non-REM stages. Each cycle is crucial for different aspects of recovery.</p>
              
              <h3>Tips for Better Sleep</h3>
              <ul>
                <li>Maintain a consistent sleep schedule</li>
                <li>Create a relaxing bedtime routine</li>
                <li>Avoid screens before bed</li>
                <li>Keep your bedroom cool and dark</li>
              </ul>
            `,
            excerpt: 'Discover how sleep impacts your health and learn strategies for better rest.',
            category: 'sleep',
            tags: ['sleep', 'wellness', 'health'],
            difficulty: 'beginner',
            readTime: 7,
            featured: true,
          },
          {
            title: 'Building a Sustainable Exercise Routine',
            content: `
              <h2>Starting Your Fitness Journey</h2>
              <p>Creating a sustainable exercise routine is about finding activities you enjoy and can maintain long-term.</p>
              
              <h3>Types of Exercise</h3>
              <p>Include a mix of cardiovascular exercise, strength training, and flexibility work for a well-rounded fitness program.</p>
              
              <h3>Setting Realistic Goals</h3>
              <p>Start small and gradually increase intensity. Consistency is more important than intensity when building a new habit.</p>
              
              <h3>Recovery Matters</h3>
              <p>Rest days are essential for muscle recovery and preventing burnout. Listen to your body and adjust accordingly.</p>
            `,
            excerpt: 'Learn how to create an exercise routine that you can stick with for the long term.',
            category: 'fitness',
            tags: ['fitness', 'exercise', 'routine'],
            difficulty: 'intermediate',
            readTime: 8,
            featured: false,
          },
          {
            title: 'Mindful Eating Practices',
            content: `
              <h2>What is Mindful Eating?</h2>
              <p>Mindful eating is the practice of paying full attention to your eating experience, without judgment.</p>
              
              <h3>Benefits</h3>
              <p>This practice can help you develop a healthier relationship with food, improve digestion, and prevent overeating.</p>
              
              <h3>How to Practice</h3>
              <ul>
                <li>Eat without distractions (no TV or phones)</li>
                <li>Chew slowly and savor each bite</li>
                <li>Pay attention to hunger and fullness cues</li>
                <li>Appreciate the flavors and textures</li>
              </ul>
            `,
            excerpt: 'Discover how mindful eating can transform your relationship with food.',
            category: 'wellness',
            tags: ['wellness', 'mindfulness', 'eating'],
            difficulty: 'beginner',
            readTime: 6,
            featured: false,
          },
          {
            title: 'Stress Management Techniques',
            content: `
              <h2>Understanding Stress</h2>
              <p>Stress is a natural response, but chronic stress can negatively impact your health. Learning to manage it is essential.</p>
              
              <h3>Breathing Exercises</h3>
              <p>Deep breathing can activate your body's relaxation response. Try the 4-7-8 technique: inhale for 4 counts, hold for 7, exhale for 8.</p>
              
              <h3>Physical Activity</h3>
              <p>Exercise releases endorphins, which are natural stress relievers. Even a short walk can help.</p>
              
              <h3>Time Management</h3>
              <p>Prioritize tasks and learn to say no. Effective time management reduces the feeling of being overwhelmed.</p>
            `,
            excerpt: 'Practical techniques to manage stress and improve your mental well-being.',
            category: 'mental',
            tags: ['mental health', 'stress', 'wellness'],
            difficulty: 'intermediate',
            readTime: 10,
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
