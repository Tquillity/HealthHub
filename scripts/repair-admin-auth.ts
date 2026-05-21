import { repairAdminAuth } from '@/lib/admin-credentials';

const useDefault = process.argv.includes('--use-default');

async function main() {
  const { email, password, source } = await repairAdminAuth({ useDefault });

  console.log('✅ Admin auth repaired');
  console.log(`   Email: ${email}`);
  console.log(`   Password source: ${source}`);
  console.log(`   Password: ${password}`);
  console.log('\n   Sign in at /sign-in with the credentials above.');
}

main().catch((error) => {
  console.error('❌ Admin auth repair failed:', error);
  process.exit(1);
});
