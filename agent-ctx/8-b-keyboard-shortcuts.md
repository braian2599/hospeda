# Task 8-b — Keyboard Shortcuts Help Overlay

**Task ID:** 8-b
**Agent:** full-stack-developer
**Project:** Hospedá (Next.js 16 + shadcn/ui + Tailwind v4 + Zustand)

## Task description
Build a `KeyboardShortcuts` overlay component that opens with `?` (Shift+/), lists all app shortcuts grouped by category in a beautiful 2-column grid, and integrates with the existing HelpDialog and AppShell.

## Work Log
- Read `worklog.md` (last 200 lines) to align with project conventions (forest-green `#0F2B28` palette, `.kbd-key` + `animate-fade-in-scale` classes already defined in `globals.css`, shadcn `Dialog` usage pattern from `HelpDialog.tsx`).
- Verified existence of `.kbd-key` (lines 688–705) and `animate-fade-in-scale` (lines 748–756) utility classes in `src/app/globals.css`.
- Created `src/components/layout/KeyboardShortcuts.tsx`:
  - `'use client'` directive, strict TypeScript, no blue/indigo colors.
  - Global `keydown` listener (added/removed via `useEffect`) that toggles `open` state when `?` (Shift+/) is pressed.
  - Listener ignores form fields via `isEditableTarget()` helper (checks `INPUT`/`TEXTAREA`/`SELECT` + `isContentEditable`).
  - Also subscribes to the custom `hospeda:open-shortcuts` window event so other components can open the overlay programmatically.
  - Uses shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` from `@/components/ui/dialog`.
  - `DialogContent` carries `animate-fade-in-scale` for premium entrance animation; `sm:max-w-2xl max-h-[85vh] overflow-y-auto` for proper sizing & scroll.
  - Header: forest-green icon badge with `Keyboard` lucide icon + title "Atajos de teclado" + description that mentions the `g` + letter sequence.
  - 3 groups (Navegación / Acciones / Generales) with all 15 shortcuts listed in the task brief.
  - Each shortcut card: title + description on top, `<kbd className="kbd-key">` keys below; 2-column grid on `sm+`, 1-column on mobile.
  - `ThenKeys` helper renders sequential keys with a `→` separator (e.g. `g → d`).
  - `Cmd/Ctrl + K` rendered as `[⌘][K] o [Ctrl][K]` for cross-platform clarity.
  - Footer: hint text "Presioná ? en cualquier momento para abrir esta ayuda" with `Command` lucide icon, plus a "Cerrar" outline button with `X` lucide icon — uses all three required icons meaningfully (`Keyboard`, `Command`, `X`).
  - `useState` for `open`; Dialog handles `Escape` natively.
- Integrated `<KeyboardShortcuts />` inside the `AppShell` function in `src/app/(app)/app/page.tsx` (after `</main>`) so it's mounted for every branch (normal module, configuracion, blocked-by-trial) — guarantees the `?` shortcut works app-wide.
- Modified `src/components/layout/HelpDialog.tsx`: added a small ghost button "Ver atajos de teclado completos" at the end of the *Atajos de teclado* section. On click it closes HelpDialog and dispatches `window.dispatchEvent(new CustomEvent('hospeda:open-shortcuts'))` (with an 80ms deferral so the first dialog can close cleanly).
- Ran `bun run lint` → exit 0 (0 errors, 0 warnings).
- Verified dev server log shows clean compilation.

## Files Touched
- **NEW:** `src/components/layout/KeyboardShortcuts.tsx` (~225 lines)
- **MODIFIED:** `src/app/(app)/app/page.tsx` — import + `<KeyboardShortcuts />` mount inside `AppShell`
- **MODIFIED:** `src/components/layout/HelpDialog.tsx` — added "Ver atajos de teclado completos" button that dispatches the custom event

## Stage Summary
Task 8-b entregó un overlay de atajos de teclado consistente con el resto de la app (paleta forest-green `#0F2B28`, mismas clases CSS que Round 6/7). El componente se monta globalmente dentro de `AppShell` para que `?` funcione en todos los estados (módulo normal, configuración, módulo bloqueado). Tres grupos (Navegación, Acciones, Generales) con 15 atajos en total, cada uno con su card propia (título + descripción + keycaps con `.kbd-key`). Integración bidireccional con `HelpDialog` vía custom event `hospeda:open-shortcuts` permite al usuario descubrir el overlay desde el diálogo de ayuda existente. Lint pasa con 0 errores.
