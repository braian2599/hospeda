import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId } from '@/lib/auth/utils';

export async function GET() {
  try {
    await requireTenantId();

    // Get ALL indexes on TenantUser (including unique indexes)
    const indexes: any[] = await db.$queryRawUnsafe(`
      SELECT
        i.relname as index_name,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        array_agg(a.attname ORDER BY array_position(ix.indkey::int[], a.attnum)) as columns
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE n.nspname = 'public'
        AND t.relname = 'TenantUser'
      GROUP BY i.relname, ix.indisunique, ix.indisprimary
      ORDER BY i.relname
    `);

    return NextResponse.json({ indexes });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

// POST: drop any unique index on (tenantId, userId)
export async function POST() {
  try {
    await requireTenantId();

    // Find unique indexes with exactly tenantId + userId
    const indexes: any[] = await db.$queryRawUnsafe(`
      SELECT
        i.relname as index_name,
        array_agg(a.attname ORDER BY array_position(ix.indkey::int[], a.attnum)) as columns
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE n.nspname = 'public'
        AND t.relname = 'TenantUser'
        AND ix.indisunique = true
        AND NOT ix.indisprimary
      GROUP BY i.relname
      HAVING array_agg(a.attname ORDER BY array_position(ix.indkey::int[], a.attnum)) = ARRAY['tenantId','userId']
    `);

    const dropped: string[] = [];
    for (const idx of indexes) {
      try {
        await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "${idx.index_name}"`);
        dropped.push(`Dropped index: ${idx.index_name}`);
      } catch (e: any) {
        dropped.push(`Failed ${idx.index_name}: ${e.message?.substring(0, 80)}`);
      }
    }

    // Also try direct names
    const tryNames = [
      'TenantUser_tenantId_userId_key',
      'tenantuser_tenantid_userid_key',
    ];
    for (const name of tryNames) {
      try {
        await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "${name}"`);
        dropped.push(`Dropped (IF EXISTS): ${name}`);
      } catch (e: any) {
        dropped.push(`Failed ${name}: ${e.message?.substring(0, 80)}`);
      }
    }

    return NextResponse.json({ indexes_found: indexes, dropped });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}