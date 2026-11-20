import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { buildAccountExport } from '@/lib/account-export';

export const dynamic = 'force-dynamic';

/** Profile > "Download my data": the signed-in user's data as a JSON file. */
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await buildAccountExport(session.user.id);
    const day = data.exportedAt.slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="healthhub-data-${day}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[account export] Failed:', error);
    return NextResponse.json(
      { error: 'Could not prepare your data. Please try again.' },
      { status: 500 }
    );
  }
}
