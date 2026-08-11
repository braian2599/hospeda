# Task 6-a — Dashboard Occupancy Trend Chart

**File modified:** `src/components/modules/DashboardModule.tsx`

## What was added

1. **Imports** (top of file):
   - `TrendingUp` from `lucide-react`
   - `AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, type TooltipProps` from `recharts` (Tooltip aliased to avoid clash with the local `Tooltip` component at line ~273)

2. **New component `OccupancyTrendChart`** (placed after `GraficoIngresosEgresos`, before `CalendarioGantt`):
   - Granular Zustand selectors: `useHotelStore(s => s.habitaciones)`, `useHotelStore(s => s.reservas)` (no props, no destructuring)
   - `mounted` state + `setTimeout` effect for fade-in (avoids `react-hooks/set-state-in-effect` lint rule)
   - `useMemo` builds 14-day data (`OccupancyDayData[]`):
     - For each day: counts unique rooms where `r.checkin <= diaStr && r.checkout > diaStr` and `r.estado !== 'Cancelada'`
     - `porcentaje = round(ocupadas / totalHabitaciones * 100)`
     - label = `${NOMBRES_DIAS[d.getDay()]} ${d.getDate()}`
   - Subtitle: Hoy % vs Promedio 7d %
   - Trend chip: ↑/↓/→ X% vs ayer (green/red/muted)
   - `AreaChart` with forest green gradient (`#34d399` → `#059669`), `type="monotone"`, `strokeWidth=2.5`
   - `XAxis` interval=0 (all 14 labels), `YAxis` domain=[0,100] with % format, width 36
   - Custom tooltip (`renderTooltip`) typed via `TooltipProps<number, string>` — shows date, %, occupied/total count
   - Container height 220 / minHeight 200
   - Card header: `TrendingUp` icon + "Tendencia de Ocupación (14 días)"

3. **Render placement** in `DashboardModule` JSX: `<OccupancyTrendChart />` between KPIs grid and `<RoomHeatmap>`.

## Verification

- `bun run lint` → 0 errors
- `bunx tsc --noEmit` → no errors in DashboardModule.tsx (pre-existing errors in unrelated files remain, none introduced here)
- `bun run dev` → `✓ Ready in 715ms`, `HEAD / 200 in 5.1s`

## Notes for downstream agents

- The `RechartsTooltip` alias is necessary because there is a local `Tooltip` component (line ~273) used by the room heatmap and income/expenses chart.
- Component is self-contained (no props) — fetches its own data via Zustand selectors. This matches the task's explicit requirement #4.
- Date interval is half-open (`checkin <= day < checkout`): the checkout day is NOT counted as occupied. This matches the existing `RoomHeatmap` logic at line ~718.
- `Cancelada` reservations are excluded from the occupancy count.
