// src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization } from 'better-auth/plugins';
import { prisma } from '@/lib/db';
import { ensurePersonalHousehold } from '@/lib/household';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      // These env vars are optional in dev; Better-Auth types require strings even when provider is disabled.
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
    x: {
      clientId: process.env.X_CLIENT_ID ?? '',
      clientSecret: process.env.X_CLIENT_SECRET ?? '',
      enabled: !!(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET),
    },
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  rateLimit: {
    customRules: {
      // The proxy calls this read-only endpoint on navigation. Those requests
      // share the server IP and must not turn valid sessions into sign-in redirects.
      '/get-session': false,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Every household-scoped feature needs a membership; give new accounts a personal household.
        after: async (user) => {
          try {
            await ensurePersonalHousehold(user);
          } catch (error) {
            // Never fail sign-up over this; the protected layout retries on the next visit.
            console.error('[HealthHub auth] Failed to create personal household:', error);
          }
        },
      },
    },
  },
  plugins: [
    organization(),
  ],
});
