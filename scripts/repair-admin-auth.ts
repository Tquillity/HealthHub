import { repairAdminAuth } from '@/lib/admin-credentials';

const useDefault = process.argv.includes('--use-default');

async function main() {
  const { email, source } = await repairAdminAuth({ useDefault });

  console.log('✅ Admin auth repaired');
  console.log(`   Email: ${email}`);
  console.log(`   Password source: ${source}`);
  console.log('\n   Sign in at /sign-in with that email and password.');
}

main().catch((error) => {
  console.error(
    '❌ Admin auth repair failed:',
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
