import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId } from '@/lib/auth/utils';

export async function GET() {
  try {
    await requireTenantId();

    // Query 1: information_schema
    const infoSchema: any[] = await db.$queryRawUnsafe(`
      SELECT c.constraint_name, c.constraint_type, k.column_name, k.ordinal_position
      FROM information_schema.table_constraints c
      JOIN information_schema.key_column_usage k
        ON c.constraint_name = k.constraint_name
       AND c.table_schema  = k.table_schema
      WHERE c.table_schema = 'public'
        AND c.table_name   = 'tenantuser'
      ORDER BY c.constraint_name, k.ordinal_position
    `);

    // Query 2: pg_constraint (direct system catalog)
    const pgConstraints: any[] = await db.$queryRawUnsafe(`
      SELECT conname, contype, conkey, connospace
      FROM pg_constraint
      WHERE conrelid = 'public."TenantUser"'::regclass
      ORDER BY conname
    `);

    // Query 3: Try to get column names for each pg_constraint
    const pgWithColumns: any[] = await db.$queryRawUnsafe(`
      SELECT
        c.conname,
        c.contype,
        array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) as columns
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public."TenantUser"'::regclass
      GROUP BY c.conname, c.contype
      ORDER BY c.conname
    `);

    return NextResponse.json({
      information_schema: infoSchema,
      pg_constraint: pgConstraints,
      pg_with_columns: pgWithColumns,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack?.substring(0, 500),
    }, { status: 500 });
  }
}

// POST: drop all multi-column unique constraints on TenantUser
export async function POST() {
  try {
    await requireTenantId();

    // Find all unique constraints with their column details
    const constraints: any[] = await db.$queryRawUnsafe(`
      SELECT
        c.conname,
        array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) as columns
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public."TenantUser"'::regclass
        AND c.contype = 'u'
      GROUP BY c.conname
      HAVING array_length(array_agg(a.attname), 1) >= 2
    `);

    const dropped: string[] = [];
    for (const c of constraints) {
      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE "TenantUser" DROP CONSTRAINT "${c.conname}"`
        );
        dropped.push(c.conname);
      } catch (e: any) {
        dropped.push(`${c.conname} (FAILED: ${e.message?.substring(0, 80)})`);
      }
    }

    // Also try known Prisma names
    const knownNames = [
      'TenantUser_tenantId_userId_key',
      'tenantuser_tenantid_userid_key',
    ];
    for (const name of knownNames) {
      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE "TenantUser" DROP CONSTRAINT IF EXISTS "${name}"`
        );
        dropped.push(`${name} (IF EXISTS)`);
      } catch (e: any) {
        dropped.push(`${name} (FAILED: ${e.message?.substring(0, 80)})`);
      }
    }

    return NextResponse.json({
      constraints_found: constraints,
      dropped,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}