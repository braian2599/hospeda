// Apply RBAC: replace requireTenantId with requirePermission in all sensitive routes
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'src/app/api');

// Map: route directory -> required permission module
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

// Specific file overrides (sub-routes with different permissions)
const FILE_OVERRIDES = {
  'reservas/[id]/checkin/route.ts': 'checkin',
  'reservas/[id]/checkout/route.ts': 'checkin',
  'usuarios/route.ts': 'usuarios',
};

function processFile(filePath, permission) {
  let content = fs.readFileSync(filePath, 'utf-8');

  if (!content.includes('requireTenantId')) {
    console.log(`  SKIP (no requireTenantId): ${path.relative(BASE, filePath)}`);
    return false;
  }

  // 1. In the import line, add requirePermission alongside requireTenantId
  //    Change: import { requireTenantId, AuthError } from '...'
  //    To:     import { requirePermission, AuthError } from '...'
  content = content.replace(
    /requireTenantId/g,
    'requirePermission'
  );

  // 2. Now all calls are requirePermission() — add the permission argument
  content = content.replace(
    /requirePermission\(\)/g,
    `requirePermission('${permission}')`
  );

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  DONE: ${path.relative(BASE, filePath)} -> '${permission}'`);
  return true;
}

let count = 0;

// Process file overrides
for (const [relPath, permission] of Object.entries(FILE_OVERRIDES)) {
  const fullPath = path.join(BASE, relPath);
  if (fs.existsSync(fullPath)) {
    console.log(`\n[override] ${relPath}`);
    if (processFile(fullPath, permission)) count++;
  }
}

// Process all route directories
for (const [routeDir, permission] of Object.entries(ROUTE_PERMISSIONS)) {
  const dirPath = path.join(BASE, routeDir);
  if (!fs.existsSync(dirPath)) continue;

  // Main route.ts
  const mainRoute = path.join(dirPath, 'route.ts');
  if (fs.existsSync(mainRoute)) {
    console.log(`\n[${routeDir}] route.ts`);
    if (processFile(mainRoute, permission)) count++;
  }

  // Sub-routes ([id]/route.ts, etc.)
  if (!fs.statSync(dirPath).isDirectory()) continue;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const subRoute = path.join(dirPath, entry.name, 'route.ts');
    if (!fs.existsSync(subRoute)) continue;
    const relPath = `${routeDir}/${entry.name}/route.ts`;
    if (FILE_OVERRIDES[relPath]) continue; // already processed
    console.log(`\n[${routeDir}] ${entry.name}/route.ts`);
    if (processFile(subRoute, permission)) count++;
  }
}

console.log(`\n=== Total: ${count} files modified ===`);