// Fix: replace ALL requireTenantId() calls with requirePermission('perm') 
// in files that were already partially converted
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'src/app/api');

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

const EXACT_FILE_OVERRIDES = {
  'reservas/[id]/checkin/route.ts': 'checkin',
  'reservas/[id]/checkout/route.ts': 'checkin',
  'usuarios/route.ts': 'usuarios',
};

function getPermission(relPath) {
  if (EXACT_FILE_OVERRIDES[relPath]) return EXACT_FILE_OVERRIDES[relPath];
  const dir = relPath.split('/')[0];
  return ROUTE_PERMISSIONS[dir] || null;
}

function fixFile(filePath, permission) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace ALL remaining requireTenantId() with requirePermission('perm')
  const regex = /requireTenantId\(\)/g;
  const matches = content.match(regex);
  if (!matches) return false;
  
  content = content.replace(regex, `requirePermission('${permission}')`);
  fs.writeFileSync(filePath, 'utf-8');
  console.log(`  Fixed ${matches.length} call(s) in ${path.relative(BASE, filePath)} -> ${permission}`);
  return true;
}

let count = 0;

// Process exact overrides
for (const [relPath, permission] of Object.entries(EXACT_FILE_OVERRIDES)) {
  const fullPath = path.join(BASE, relPath);
  if (fs.existsSync(fullPath)) {
    if (fixFile(fullPath, permission)) count++;
  }
}

// Process all route directories
for (const [routeDir, permission] of Object.entries(ROUTE_PERMISSIONS)) {
  const dirPath = path.join(BASE, routeDir);
  if (!fs.existsSync(dirPath)) continue;

  // Main route.ts
  const mainRoute = path.join(dirPath, 'route.ts');
  if (fs.existsSync(mainRoute)) {
    if (fixFile(mainRoute, permission)) count++;
  }

  // Subdirectories
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const subRoute = path.join(dirPath, entry.name, 'route.ts');
    if (!fs.existsSync(subRoute)) continue;
    const relPath = `${routeDir}/${entry.name}/route.ts`;
    if (EXACT_FILE_OVERRIDES[relPath]) continue;
    if (fixFile(subRoute, permission)) count++;
  }
}

console.log(`\n=== Total files fixed: ${count} ===`);