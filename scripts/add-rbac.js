// Script para agregar RBAC a todas las rutas de API que usan requireTenantId
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'src/app/api');

// Mapping: ruta base -> permiso requerido
const ROUTE_PERMISSIONS = {
  'pagos': 'facturacion',
  'caja': 'facturacion',
  'gastos': 'facturacion',
  'categorias-gasto': 'facturacion',
  'metodos-pago': 'facturacion',
  'reportes': 'reportes',
  'habitaciones': 'habitaciones',
  'tarifas': 'tarifas',
  'clientes': 'clientes',
  'reservas': 'reservas',
};

// Archivos que no deben tocarse (sub-rutas con permisos diferentes)
const EXACT_FILE_OVERRIDES = {
  'reservas/[id]/checkin/route.ts': 'checkin',
  'reservas/[id]/checkout/route.ts': 'checkin',
  'usuarios/route.ts': 'usuarios',
};

function processFile(filePath, permission) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // Check if file uses requireTenantId
  if (!content.includes('requireTenantId')) {
    console.log(`  SKIP (no usa requireTenantId): ${filePath}`);
    return false;
  }

  // Check if already uses requirePermission
  if (content.includes('requirePermission')) {
    console.log(`  SKIP (ya tiene requirePermission): ${filePath}`);
    return false;
  }

  // 1. Update import: add requirePermission
  if (content.includes("from '@/lib/auth/utils'")) {
    // Add requirePermission to existing import
    if (content.includes('requireTenantId')) {
      content = content.replace(
        "requireTenantId",
        "requirePermission"
      );
      // Also keep requireTenantId if it's still needed (it won't be, but let's check)
      // Actually we replaced ALL requireTenantId with requirePermission
      // We need to add requireTenantId back if there are still calls
      // But since we're replacing the calls too, it's fine
    }
    changed = true;
  }

  // 2. Replace all requireTenantId() calls with requirePermission('permission')
  if (content.includes('requirePermission()')) {
    content = content.replace(
      /requirePermission\(\)/g,
      `requirePermission('${permission}')`
    );
    changed = true;
  }

  // 3. If the import only has requirePermission but we also need AuthError, keep it
  // The import should now have: requirePermission, AuthError (since we replaced requireTenantId)

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  DONE: ${filePath} -> ${permission}`);
    return true;
  }

  console.log(`  NO CHANGE: ${filePath}`);
  return false;
}

// Process exact file overrides first
let count = 0;
for (const [relPath, permission] of Object.entries(EXACT_FILE_OVERRIDES)) {
  const fullPath = path.join(BASE, relPath);
  if (fs.existsSync(fullPath)) {
    console.log(`\nProcessing override: ${relPath}`);
    if (processFile(fullPath, permission)) count++;
  }
}

// Process all routes by directory
for (const [routeDir, permission] of Object.entries(ROUTE_PERMISSIONS)) {
  const dirPath = path.join(BASE, routeDir);

  // Process main route file
  const mainRoute = path.join(dirPath, 'route.ts');
  if (fs.existsSync(mainRoute)) {
    console.log(`\nProcessing: ${routeDir}/route.ts`);
    if (processFile(mainRoute, permission)) count++;
  }

  // Process subdirectory routes (e.g., [id]/route.ts)
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subRoute = path.join(dirPath, entry.name, 'route.ts');
        if (fs.existsSync(subRoute)) {
          // Skip if it's an override already processed
          const relPath = `${routeDir}/${entry.name}/route.ts`;
          if (EXACT_FILE_OVERRIDES[relPath]) continue;

          console.log(`\nProcessing: ${routeDir}/${entry.name}/route.ts`);
          if (processFile(subRoute, permission)) count++;
        }
      }
    }
  }
}

console.log(`\n=== Total files modified: ${count} ===`);