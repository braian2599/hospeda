const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'src');

// ── 1. Password validation: replace `password.length < 6` with validatePassword ──
const apiFiles = [
  'app/api/auth/register/route.ts',
  'app/api/auth/reset-password/route.ts',
  'app/api/auth/complete-profile/route.ts',
  'app/api/auth/accept-invitation/route.ts',
  'app/api/usuarios/route.ts',
  'app/api/usuarios/[id]/route.ts',
];

for (const rel of apiFiles) {
  const fp = path.join(BASE, rel);
  if (!fs.existsSync(fp)) { console.log(`SKIP (not found): ${rel}`); continue; }
  let content = fs.readFileSync(fp, 'utf-8');
  let changed = false;

  // Add import if not present
  if (!content.includes("from '@/lib/validation'")) {
    // Find the last import line
    const importRegex = /^(import .+;)$/gm;
    const matches = [...content.matchAll(importRegex)];
    if (matches.length > 0) {
      const lastImport = matches[matches.length - 1];
      const insertPos = lastImport.index + lastImport[0].length;
      content = content.slice(0, insertPos) + '\n' + "import { validatePassword, rateLimit, checkBodySize } from '@/lib/validation';" + content.slice(insertPos);
      changed = true;
    }
  }

  // Replace password length check
  const patterns = [
    { from: /if \(password && password\.length >= 6\)/, to: 'if (password)' },
    { from: /if \(!password \|\| password\.length < 6\) \{\s*return NextResponse\.json\(\s*\{ error: 'La contraseña debe tener al menos 6 caracteres' \},\s*\{ status: 400 \}\s*\);\s*\}/, to: "const pwError = validatePassword(password);\n    if (pwError) {\n      return NextResponse.json({ error: pwError }, { status: 400 });\n    }" },
    { from: /if \(password\.length < 6\) \{\s*return NextResponse\.json\(\s*\{ error: 'La contraseña debe tener al menos 6 caracteres' \},\s*\{ status: 400 \}\s*\);\s*\}/, to: "const pwError = validatePassword(password);\n    if (pwError) {\n      return NextResponse.json({ error: pwError }, { status: 400 });\n    }" },
    { from: /if \(newPassword\.length < 6\) \{\s*return NextResponse\.json\(\s*\{ error: 'Minimo 6 caracteres' \},\s*\{ status: 400 \}\s*\);\s*\}/, to: "const pwError = validatePassword(newPassword);\n    if (pwError) {\n      return NextResponse.json({ error: pwError }, { status: 400 });\n    }" },
  ];

  for (const p of patterns) {
    if (p.from.test(content)) {
      content = content.replace(p.from, p.to);
      changed = true;
    }
  }

  // Add body size check after req.json() in POST/PUT routes
  if (content.includes('await req.json()') && !content.includes('checkBodySize')) {
    content = content.replace(
      /(export async function (POST|PUT)\([^)]*\) \{\s*try \{)/,
      '$1\n    checkBodySize(req);'
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(fp, content, 'utf-8');
    console.log(`PATCHED: ${rel}`);
  } else {
    console.log(`OK (no changes): ${rel}`);
  }
}

// ── 2. Update frontend password messages ──
const frontendFiles = [
  'app/(auth)/register/page.tsx',
  'app/(auth)/reset-password/page.tsx',
  'app/(auth)/accept-invitation/page.tsx',
];

for (const rel of frontendFiles) {
  const fp = path.join(BASE, rel);
  if (!fs.existsSync(fp)) { console.log(`SKIP (not found): ${rel}`); continue; }
  let content = fs.readFileSync(fp, 'utf-8');
  let changed = false;

  // Replace 6 char messages with 8 char messages
  content = content.replace(/al menos 6 caracteres/g, 'al menos 8 caracteres, una mayúscula y un número');
  content = content.replace(/mínimo 6 caracteres/g, 'mínimo 8 caracteres, una mayúscula y un número');
  content = content.replace(/6 caracteres/g, '8 caracteres');
  content = content.replace(/length < 6/g, 'length < 8');
  content = content.replace(/maxLength:\s*\{\s*value:\s*128/g, 'maxLength: { value: 128, message: \'Máximo 128 caracteres\' }');

  fs.writeFileSync(fp, content, 'utf-8');
  console.log(`PATCHED frontend: ${rel}`);
}

// ── 3. Update component files ──
const componentFiles = [
  'components/modules/UsuariosModule.tsx',
  'components/ProfileSetup.tsx',
];

for (const rel of componentFiles) {
  const fp = path.join(BASE, rel);
  if (!fs.existsSync(fp)) { console.log(`SKIP (not found): ${rel}`); continue; }
  let content = fs.readFileSync(fp, 'utf-8');
  content = content.replace(/al menos 6 caracteres/g, 'al menos 8 caracteres, una mayúscula y un número');
  content = content.replace(/6 caracteres/g, '8 caracteres');
  content = content.replace(/\.length < 6/g, '.length < 8');
  fs.writeFileSync(fp, content, 'utf-8');
  console.log(`PATCHED component: ${rel}`);
}

console.log('\nDone!');
