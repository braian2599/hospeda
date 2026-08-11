# Task 6-e — Help & Keyboard Shortcuts Dialog

**Task ID:** 6-e
**Agent:** help-dialog-agent
**Task:** Add a "Help & Keyboard Shortcuts" dialog accessible from the Sidebar with global "g + letter" keyboard navigation.

## Work Log

### Files

- **NEW**: `src/components/layout/HelpDialog.tsx` (~225 lines)
- **MODIFIED**: `src/components/layout/Sidebar.tsx` (only additive — 1 import + 3 placements)

### HelpDialog.tsx

Read `/home/z/my-project/worklog.md` first to learn project conventions:
- Forest green `#0F2B28` is the brand primary (no blue/indigo).
- Granular Zustand selectors preferred (here we only call `useHotelStore.getState().setModulo(...)` from inside an event handler — no reactive subscription needed).
- `useSyncExternalStore` or deferred setState used to avoid the `react-hooks/set-state-in-effect` lint rule. Not relevant here since we don't setState in effects.
- Existing pattern: `ThemeToggle` and `NotificationCenter` accept a `compact` prop to control button sizing (`h-8 w-8` vs `h-9 w-9`).

**Structure:**

1. **`useGSequenceNavigation` hook** (module-level, idempotent — runs once per mount of `HelpDialog`):
   - Listens globally for `keydown`.
   - Ignores when typing in `INPUT` / `TEXTAREA` / `SELECT` or `contentEditable` elements (via `isEditableTarget`).
   - Ignores when a modifier (`metaKey` / `ctrlKey` / `altKey`) is held so Cmd+K etc. are not hijacked.
   - On first `g` press (when no timer active), starts a 500ms timer. While the timer is active, the next key is matched against the `G_NAV_MAP`:
     - `d` → `dashboard`
     - `r` → `reservas`
     - `h` → `habitaciones`
     - `c` → `clientes`
   - On match: `e.preventDefault()` + `useHotelStore.getState().setModulo(modulo)`.
   - On any other key or timer expiry: clears the timer, no-op.
   - Cleanup on unmount removes the listener and clears the timer.

2. **Presentational helpers**:
   - `Kbd` — wraps children in `<kbd className="px-2 py-0.5 text-xs font-mono font-semibold bg-muted border border-border rounded shadow-sm">` (exact spec).
   - `SectionLabel` — `<h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">` (exact spec).
   - `ShortcutRow` — two-column row with the label on the left and the key caps on the right.

3. **`HelpDialog` default export** (`{ compact }` prop to match `ThemeToggle` API):
   - Calls `useGSequenceNavigation()` unconditionally (so the global shortcut works even when the dialog is closed).
   - Local `open` state via `useState(false)` (no Radix `DialogTrigger` needed since we want the trigger button styled like the other sidebar icon buttons).
   - **Trigger button**: ghost `Button` with `Keyboard` icon, `aria-label="Ayuda y atajos"`, same classes as `ThemeToggle` (forest-sidebar hover `bg-[#162826]`). Respects `compact` for sizing.
   - **Dialog content** (`sm:max-w-md`, `max-h-[85vh] overflow-y-auto`):
     - Header: small `Keyboard` icon tile in `bg-[#0F2B28]` + title "Atajos de teclado y consejos" + subtitle description.
     - **ATAJOS DE TECLADO** section: bordered box (`bg-muted/30`, `divide-y divide-border/60`) with 6 `ShortcutRow`s:
       - `⌘K` / `Ctrl K` → Búsqueda rápida
       - `Esc` → Cerrar diálogos
       - `g` `d` → Ir a Dashboard
       - `g` `r` → Ir a Reservas
       - `g` `h` → Ir a Habitaciones
       - `g` `c` → Ir a Clientes
     - **CONSEJOS RÁPIDOS** section: `<ul>` with 4 items, each prefixed by a `Sparkles` icon (forest green `#0F2B28`). Tips copied verbatim from the spec.
     - **¿NECESITAS AYUDA?** section:
       - Primary **"Contactar soporte"** button (`bg-[#0F2B28] hover:bg-[#0F2B28]/90 text-white`) with `LifeBuoy` icon — opens `mailto:soporte@hospeda.com?subject=Ayuda%20Hosped%C3%A1`.
       - Secondary **"Enviar feedback"** link button (border style) with `MessageSquare` icon → `mailto:feedback@hospeda.com`.
       - Helper text "Tiempo de respuesta promedio: menos de 24 hs hábiles."
   - Uses `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` from `@/components/ui/dialog`.
   - Uses `Button` from `@/components/ui/button`.
   - Uses `Keyboard`, `LifeBuoy`, `MessageSquare`, `Sparkles` from `lucide-react`.

### Sidebar.tsx integration (3 placements, additive only)

Added `import HelpDialog from '@/components/layout/HelpDialog';` right after the existing `ThemeToggle` import.

1. **Desktop expanded view** — inside the `flex items-center gap-0.5` header row (right after `<ThemeToggle compact />`):
   ```tsx
   <ThemeToggle compact />
   <HelpDialog compact />
   ```

2. **Mobile sidebar** — in the `<div className="flex items-center gap-3 px-4 py-4">` header row (right after `<ThemeToggle compact />`):
   ```tsx
   <ThemeToggle compact />
   <HelpDialog compact />
   ```

3. **Desktop collapsed view** — in the fixed bottom-left quick actions cluster (`hidden lg:flex flex-col items-center gap-1 py-2 fixed left-3 bottom-20 z-30`), right after `<ThemeToggle compact />`:
   ```tsx
   <ThemeToggle compact />
   <HelpDialog compact />
   ```

No existing functionality was modified. All 3 placements follow the exact same pattern as the existing `ThemeToggle` and `NotificationCenter` integrations.

### Constraints met

- ✅ `'use client'` directive at top of `HelpDialog.tsx`.
- ✅ Forest green `#0F2B28` used for primary actions (icon tile, "Contactar soporte" button, tip icon accents). No blue/indigo.
- ✅ TypeScript types correct (`ModuloId` imported from `@/lib/types`, `Record<string, ModuloId>` for the nav map).
- ✅ Did NOT modify existing functionality — only ADD (1 new file + 4 lines added to Sidebar.tsx).
- ✅ Did NOT add test files.
- ✅ Used existing shadcn `Dialog` component.
- ✅ `Keyboard` icon from `lucide-react` used for the trigger button.
- ✅ `<kbd>` styling matches the spec exactly: `px-2 py-0.5 text-xs font-mono font-semibold bg-muted border border-border rounded shadow-sm`.
- ✅ Section headers styled with `text-xs uppercase tracking-wider text-muted-foreground font-semibold`.
- ✅ "Contactar soporte" button opens `mailto:soporte@hospeda.com`.
- ✅ Trigger button has `aria-label="Ayuda y atajos"`.
- ✅ Keyboard navigation ignores inputs/textareas (via `tagName` check) and modifiers.
- ✅ Lint: `bun run lint` → **0 errors, 0 warnings** (exit code 0).
- ✅ Dev server healthy (`✓ Ready in 715ms`, `HEAD / 200 in 5.1s`).

## Stage Summary

The Hospedá sidebar now has a Help & Keyboard Shortcuts dialog accessible from three locations (desktop expanded header, desktop collapsed bottom-left cluster, and mobile header), opening a polished dialog showing all keyboard shortcuts (⌘K, Esc, g d/r/h/c), 4 quick-start tips, and a "Contactar soporte" button that opens a `mailto:` link. In parallel, a global keydown listener enables the `g + letter` navigation pattern: pressing `g` starts a 500ms window during which pressing `d`, `r`, `h`, or `c` navigates to the Dashboard, Reservas, Habitaciones, or Clientes module via `useHotelStore.getState().setModulo(...)`. The listener correctly ignores inputs/textareas and modifier-held keys so existing shortcuts (⌘K, etc.) keep working. Lint and TypeScript are clean.
