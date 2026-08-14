'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useHotelStore } from '@/lib/store';
import { MODULOS_SISTEMA, type ModuloId } from '@/lib/types';
import { api, type DbTenantUser } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Plus, UserCog, Pencil, Shield, ShieldCheck, Loader2, Eye, EyeOff, KeyRound,
  Users, UserCheck, Mail, Crown, Ban, RotateCcw, MoreVertical, Check, X, Activity,
  ArrowRight, Clock, CheckCircle2, LayoutGrid,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/** Get initials from a full name (first letter of first word + first letter of last word) */
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Format a date string as relative time in Spanish (short form) */
const formatRelativeTime = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'recién';
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHrs < 24) return `hace ${diffHrs} h`;
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} sem`;
  if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} meses`;
  return `hace ${Math.floor(diffDays / 365)} años`;
};

/** Generate a random password: 10 chars, at least one uppercase + one digit */
const randomPassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const chars: string[] = [pick(upper), pick(digits)];
  for (let i = 2; i < 10; i++) chars.push(pick(all));
  // Fisher-Yates shuffle to avoid predictable positions
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

// ═══════════════════════════════════════════════════════════
// ROLES & PERMISSIONS
// ═══════════════════════════════════════════════════════════

type RolId = 'owner' | 'admin' | 'recepcion' | 'limpieza';

interface RoleInfo {
  value: RolId;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Shield;
  colorHex: string;
  badgeClass: string;
  borderClass: string;
  avatarGradient: string;
}

const ROLES: RoleInfo[] = [
  {
    value: 'owner',
    label: 'Administrador Principal',
    shortLabel: 'Owner',
    description: 'Acceso total al sistema',
    icon: Crown,
    colorHex: '#F59E0B',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    borderClass: 'border-l-amber-500',
    avatarGradient: 'from-amber-400 to-amber-600',
  },
  {
    value: 'admin',
    label: 'Admin',
    shortLabel: 'Admin',
    description: 'Acceso completo a todos los módulos',
    icon: ShieldCheck,
    colorHex: '#0F2B28',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    borderClass: 'border-l-emerald-700',
    avatarGradient: 'from-[#0F2B28] to-[#1a4a44]',
  },
  {
    value: 'recepcion',
    label: 'Recepción',
    shortLabel: 'Recepción',
    description: 'Habitaciones, reservas, check-in y clientes',
    icon: UserCog,
    colorHex: '#0EA5E9',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    borderClass: 'border-l-sky-400',
    avatarGradient: 'from-sky-400 to-sky-600',
  },
  {
    value: 'limpieza',
    label: 'Limpieza',
    shortLabel: 'Limpieza',
    description: 'Tareas de limpieza y mantenimiento',
    icon: Shield,
    colorHex: '#8B5CF6',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    borderClass: 'border-l-violet-400',
    avatarGradient: 'from-violet-400 to-violet-600',
  },
];

const PERMISOS_POR_ROL: Record<string, ModuloId[]> = {
  owner: ['dashboard', 'habitaciones', 'reservas', 'checkin', 'facturacion', 'limpieza', 'caja', 'clientes', 'reportes', 'usuarios', 'tarifas'],
  admin: ['dashboard', 'habitaciones', 'reservas', 'checkin', 'facturacion', 'limpieza', 'caja', 'clientes', 'reportes', 'usuarios', 'tarifas'],
  recepcion: ['dashboard', 'habitaciones', 'reservas', 'checkin', 'clientes', 'tarifas'],
  limpieza: ['dashboard', 'habitaciones', 'limpieza'],
};

// Modules that some roles can access as "read-only" (amber in matrix)
const READ_ONLY_PERMISOS: Partial<Record<string, ModuloId[]>> = {
  limpieza: ['reservas'],
};

const ASSIGNABLE_ROLES = ROLES.filter(r => r.value !== 'owner');

const ROLE_LABELS: Record<string, string> = {
  owner: 'Administrador Principal',
  admin: 'Admin',
  recepcion: 'Recepción',
  limpieza: 'Limpieza',
};

const getRoleInfo = (rol: string): RoleInfo => ROLES.find(r => r.value === rol) || ROLES[1];

// ═══════════════════════════════════════════════════════════
// FORM TYPES
// ═══════════════════════════════════════════════════════════

interface UserForm {
  nombreCompleto: string;
  password: string;
  rol: string;
  permisos: ModuloId[];
}

const emptyForm: UserForm = {
  nombreCompleto: '',
  password: '',
  rol: 'recepcion',
  permisos: ['dashboard', 'habitaciones', 'reservas', 'checkin', 'clientes', 'tarifas'],
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function UsuariosModule() {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const auditoria = useHotelStore(s => s.auditoria);
  const setModulo = useHotelStore(s => s.setModulo);

  const [usuarios, setUsuarios] = useState<DbTenantUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit user dialog (existing)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<DbTenantUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [ownerEditing, setOwnerEditing] = useState(false);

  // New: permissions matrix dialog
  const [permisosDialogOpen, setPermisosDialogOpen] = useState(false);
  const [matrixPermisos, setMatrixPermisos] = useState<Record<string, ModuloId[]>>({});
  const [matrixSaving, setMatrixSaving] = useState(false);

  // New: invite user dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ nombre: '', rol: 'recepcion' });
  const [inviteTempPassword, setInviteTempPassword] = useState('');
  const [inviting, setInviting] = useState(false);

  // New: reset password dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<DbTenantUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // New: pending invitations counter (session-tracked)
  const [pendingInvites, setPendingInvites] = useState(0);

  const esOwner = usuarioActual?.rol === 'owner';
  const esAdminOOwner = esOwner || usuarioActual?.rol === 'admin';
  const puedeModificar = esOwner || usuarioActual?.permisos.includes('usuarios');

  // ═══════════════════════════════════════════════════════════
  // FETCH
  // ═══════════════════════════════════════════════════════════

  const fetchUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.usuarios.list();
      setUsuarios(data);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  // ═══════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════

  const stats = useMemo(() => {
    const total = usuarios.length;
    const activos = usuarios.filter(u => u.activo).length;
    const porRol = {
      owner: usuarios.filter(u => u.rol === 'owner').length,
      admin: usuarios.filter(u => u.rol === 'admin').length,
      recepcion: usuarios.filter(u => u.rol === 'recepcion').length,
      limpieza: usuarios.filter(u => u.rol === 'limpieza').length,
    };
    return { total, activos, porRol };
  }, [usuarios]);

  const recentActivity = useMemo(() => auditoria.slice(0, 5), [auditoria]);

  /** Cross-reference audit entries to find the last login timestamp for a user. */
  const getLastLogin = useCallback((u: DbTenantUser): string | null => {
    const name = u.nombreCompleto || u.user?.name;
    if (!name) return null;
    const entry = auditoria.find(a => a.tipo === 'Login' && a.empleado === name);
    return entry?.fecha || null;
  }, [auditoria]);

  // ═══════════════════════════════════════════════════════════
  // CREATE / EDIT USER DIALOG (existing functionality, preserved)
  // ═══════════════════════════════════════════════════════════

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowPassword(false);
    setOwnerEditing(false);
    setDialogOpen(true);
  };

  const openEdit = (u: DbTenantUser) => {
    setEditingId(u.id);
    setForm({
      nombreCompleto: u.nombreCompleto || '',
      password: '',
      rol: u.rol,
      permisos: (u.permisos || []) as ModuloId[],
    });
    setShowPassword(false);
    setOwnerEditing(u.rol === 'owner');
    setDialogOpen(true);
  };

  const openDelete = (u: DbTenantUser) => {
    if (u.rol === 'owner') {
      toast.error('El Administrador Principal no puede ser eliminado');
      return;
    }
    setDeletingUser(u);
    setDeleteDialogOpen(true);
  };

  const handleRolChange = (newRol: string) => {
    setForm(f => ({
      ...f,
      rol: newRol,
      permisos: PERMISOS_POR_ROL[newRol] || [],
    }));
  };

  const togglePermiso = (moduloId: ModuloId) => {
    setForm(f => ({
      ...f,
      permisos: f.permisos.includes(moduloId)
        ? f.permisos.filter(p => p !== moduloId)
        : [...f.permisos, moduloId],
    }));
  };

  const handleSave = async () => {
    if (!form.nombreCompleto.trim()) { toast.error('El nombre del perfil es obligatorio'); return; }
    if (!editingId && form.password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número'); return; }

    setSaving(true);
    try {
      if (editingId) {
        const updateData: Record<string, unknown> = {
          nombreCompleto: form.nombreCompleto.trim() || undefined,
          rol: form.rol,
          permisos: form.permisos,
        };
        if (form.password.length >= 6) {
          updateData.password = form.password;
        }
        await api.usuarios.update(editingId, updateData);
        toast.success('Perfil actualizado');
      } else {
        await api.usuarios.create({
          nombreCompleto: form.nombreCompleto.trim(),
          password: form.password,
          rol: form.rol,
          permisos: form.permisos,
        });
        toast.success('Usuario creado correctamente');
      }
      setDialogOpen(false);
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await api.usuarios.delete(deletingUser.id);
      toast.success('Usuario suspendido');
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // PERMISSIONS MATRIX
  // ═══════════════════════════════════════════════════════════

  const openMatrix = () => {
    const matrix: Record<string, ModuloId[]> = {};
    for (const rol of ['owner', 'admin', 'recepcion', 'limpieza']) {
      const usersOfRol = usuarios.filter(u => u.rol === rol);
      matrix[rol] = usersOfRol[0]?.permisos
        ? [...(usersOfRol[0].permisos as ModuloId[])]
        : [...(PERMISOS_POR_ROL[rol] || [])];
    }
    // Owner always has all modules
    matrix['owner'] = MODULOS_SISTEMA.map(m => m.id);
    setMatrixPermisos(matrix);
    setPermisosDialogOpen(true);
  };

  const toggleMatrixPermiso = (rol: string, moduloId: ModuloId) => {
    if (rol === 'owner') return; // owner column is read-only
    setMatrixPermisos(prev => {
      const current = prev[rol] || [];
      return {
        ...prev,
        [rol]: current.includes(moduloId)
          ? current.filter(p => p !== moduloId)
          : [...current, moduloId],
      };
    });
  };

  const saveMatrix = async () => {
    setMatrixSaving(true);
    try {
      let updatedCount = 0;
      for (const rol of ['admin', 'recepcion', 'limpieza']) {
        const newPerms = matrixPermisos[rol] || [];
        const usersOfRol = usuarios.filter(u => u.rol === rol && u.activo);
        for (const u of usersOfRol) {
          const currentSorted = [...(u.permisos || [])].sort().join(',');
          const newSorted = [...newPerms].sort().join(',');
          if (currentSorted !== newSorted) {
            await api.usuarios.update(u.id, { permisos: newPerms });
            updatedCount++;
          }
        }
      }
      toast.success(updatedCount > 0
        ? `Permisos actualizados para ${updatedCount} usuario(s)`
        : 'Sin cambios para aplicar'
      );
      setPermisosDialogOpen(false);
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar permisos');
    } finally {
      setMatrixSaving(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // INVITE USER
  // ═══════════════════════════════════════════════════════════

  const openInvite = () => {
    setInviteForm({ nombre: '', rol: 'recepcion' });
    setInviteTempPassword(randomPassword());
    setInviteDialogOpen(true);
  };

  const handleInvite = async () => {
    if (!inviteForm.nombre.trim()) {
      toast.error('El nombre del perfil es obligatorio');
      return;
    }
    if (inviteForm.rol === 'owner') {
      toast.error('No se pueden invitar usuarios con rol Owner');
      return;
    }
    if (inviteTempPassword.length < 8) {
      toast.error('La contraseña temporal debe tener al menos 8 caracteres');
      return;
    }
    setInviting(true);
    try {
      await api.usuarios.create({
        nombreCompleto: inviteForm.nombre.trim(),
        password: inviteTempPassword,
        rol: inviteForm.rol,
        permisos: PERMISOS_POR_ROL[inviteForm.rol] || [],
      });
      setPendingInvites(n => n + 1);
      toast.success(`Invitación enviada a ${inviteForm.nombre.trim()}`, {
        description: `Compartí esta contraseña temporal: ${inviteTempPassword}`,
        duration: 10000,
      });
      setInviteDialogOpen(false);
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.message || 'Error al invitar usuario');
    } finally {
      setInviting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RESET PASSWORD
  // ═══════════════════════════════════════════════════════════

  const openReset = (u: DbTenantUser) => {
    if (u.rol === 'owner' && !esOwner) {
      toast.error('Solo el Administrador Principal puede restablecer su propia contraseña');
      return;
    }
    setResetTargetUser(u);
    setResetPassword(randomPassword());
    setResetDialogOpen(true);
  };

  const handleReset = async () => {
    if (!resetTargetUser) return;
    if (resetPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setResetting(true);
    try {
      await api.usuarios.update(resetTargetUser.id, { password: resetPassword });
      toast.success(`Contraseña restablecida para ${resetTargetUser.nombreCompleto}`, {
        description: `Nueva contraseña temporal: ${resetPassword}`,
        duration: 12000,
      });
      setResetDialogOpen(false);
      setResetTargetUser(null);
    } catch (err: any) {
      toast.error(err.message || 'Error al restablecer contraseña');
    } finally {
      setResetting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MISC HELPERS
  // ═══════════════════════════════════════════════════════════

  const isSelf = (u: DbTenantUser) => {
    if (!usuarioActual?.tenantUserId) return u.user?.id === usuarioActual?.id;
    return u.id === usuarioActual.tenantUserId;
  };

  const canEditUser = (u: DbTenantUser) => {
    if (!puedeModificar) return false;
    if (u.rol === 'owner' && !esOwner) return false;
    return true;
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="space-y-5">
      <ModuleHeader icon={UserCog} title="Usuarios" subtitle="Gestioná perfiles, roles y permisos de tu equipo">
        <div className="flex items-center gap-2 flex-wrap">
          {puedeModificar && (
            <>
              <Button variant="outline" size="sm" onClick={openMatrix} className="gap-1.5">
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Ver permisos</span>
              </Button>
              <Button variant="outline" size="sm" onClick={openInvite} className="gap-1.5">
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">Invitar</span>
              </Button>
              <Button onClick={openCreate} size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> Crear usuario
              </Button>
            </>
          )}
        </div>
      </ModuleHeader>

      {/* ═══════════ STATS SUMMARY ═══════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Usuarios */}
        <Card className="relative overflow-hidden border-l-[3px] border-l-emerald-500 bg-emerald-950/20 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Usuarios</p>
                <AnimatedNumber value={stats.total} format={n => String(Math.round(n))} className="text-2xl font-bold text-emerald-400" />
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activos */}
        <Card className="relative overflow-hidden border-l-[3px] border-l-emerald-500 bg-emerald-950/20 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activos</p>
                <AnimatedNumber value={stats.activos} format={n => String(Math.round(n))} className="text-2xl font-bold text-emerald-700" />
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Por Rol */}
        <Card className="relative overflow-hidden border-l-[3px] border-l-sky-400 bg-sky-950/20 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Por Rol</p>
                <div className="flex items-center gap-2 text-xs font-semibold mt-1 flex-wrap">
                  <span className="text-amber-700 flex items-center gap-0.5">
                    <Crown className="w-2.5 h-2.5" />{stats.porRol.owner}
                  </span>
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" />{stats.porRol.admin}
                  </span>
                  <span className="text-sky-700 flex items-center gap-0.5">
                    <UserCog className="w-2.5 h-2.5" />{stats.porRol.recepcion}
                  </span>
                  <span className="text-violet-700 flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5" />{stats.porRol.limpieza}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-sky-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invitaciones Pendientes */}
        <Card className="relative overflow-hidden border-l-[3px] border-l-amber-400 bg-amber-950/20 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Invitaciones Pendientes</p>
                <AnimatedNumber value={pendingInvites} format={n => String(Math.round(n))} className="text-2xl font-bold text-amber-700" />
                <p className="text-[10px] text-muted-foreground">En esta sesión</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════ USER CARDS (enhanced) ═══════════ */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : usuarios.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay usuarios activos. Creá el primer perfil con el botón de arriba.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {usuarios.map(u => {
            const roleInfo = getRoleInfo(u.rol);
            const Icon = roleInfo.icon;
            const name = u.nombreCompleto || u.user?.name || 'Sin nombre';
            const initials = getInitials(name);
            const email = u.user?.email;
            const lastLogin = getLastLogin(u);
            const isOwner = u.rol === 'owner';
            const canEdit = canEditUser(u);

            return (
              <Card
                key={u.id}
                className={`relative overflow-hidden border-l-[3px] ${roleInfo.borderClass} hover:shadow-md transition-all duration-200 ${isOwner ? 'bg-amber-50/30' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${roleInfo.avatarGradient} flex items-center justify-center text-white font-semibold shrink-0 shadow-sm`}>
                      {initials}
                      {/* Status indicator */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${u.activo ? 'bg-emerald-500' : 'bg-gray-400'}`}
                        title={u.activo ? 'Activo' : 'Inactivo'}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {name}
                            {isSelf(u) && <span className="text-muted-foreground font-normal ml-1.5 text-xs">(vos)</span>}
                          </p>
                          {email && (
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{email}</span>
                            </p>
                          )}
                        </div>

                        {/* Quick actions */}
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Acciones">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openEdit(u)}>
                                <Pencil className="w-3.5 h-3.5" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openReset(u)}>
                                <KeyRound className="w-3.5 h-3.5" /> Restablecer contraseña
                              </DropdownMenuItem>
                              {!isOwner && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => openDelete(u)}>
                                    <Ban className="w-3.5 h-3.5" /> Suspender
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {/* Role badge + perms count */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 ${roleInfo.badgeClass}`}>
                          <Icon className="w-2.5 h-2.5" />
                          {roleInfo.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {u.permisos?.length || 0}/{MODULOS_SISTEMA.length} módulos
                        </span>
                      </div>

                      {/* Last login */}
                      {lastLogin && (
                        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Último acceso: {formatRelativeTime(lastLogin)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════════ ACTIVITY LOG ═══════════ */}
      {recentActivity.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold">Actividad reciente</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 hover:text-emerald-400"
                onClick={() => setModulo('reportes')}
              >
                Ver todo <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {recentActivity.map((a, idx) => (
                <div key={a.id} className="flex items-start gap-3 text-xs">
                  <div className="flex flex-col items-center self-stretch">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${idx === 0 ? 'bg-[#0F2B28]' : 'bg-[#0F2B28]/40'}`} />
                    {idx < recentActivity.length - 1 && (
                      <div className="w-px flex-1 bg-emerald-500/20 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-foreground leading-snug">
                      <span className="font-medium">{a.empleado}</span>{' '}
                      <span className="text-muted-foreground">{a.detalle}</span>
                    </p>
                    <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]">
                      <Clock className="w-2.5 h-2.5" />
                      {formatRelativeTime(a.fecha)} · <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">{a.tipo}</Badge>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════ DIALOG: CREAR / EDITAR USUARIO (existing) ═══════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {ownerEditing ? 'Editar tu perfil' : (editingId ? 'Editar usuario' : 'Crear nuevo usuario')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nombre del perfil */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {ownerEditing ? 'Tu nombre' : 'Nombre del perfil'}
              </Label>
              <Input
                placeholder={ownerEditing ? 'Ej: Juan Perez' : 'Ej: Gerente, Admin 1, Recepcion Laura...'}
                value={form.nombreCompleto}
                onChange={e => setForm(f => ({ ...f, nombreCompleto: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                {ownerEditing ? 'Este nombre se muestra en el sistema' : 'Es el nombre que se va a mostrar al ingresar'}
              </p>
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <KeyRound className="w-3 h-3" />
                {editingId ? 'Nueva contraseña (dejar vacio para no cambiar)' : 'Contraseña'}
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={editingId ? 'Solo si queres cambiarla' : 'Minimo 8 caracteres'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Con esta contraseña el usuario va a ingresar al sistema
              </p>
            </div>

            {/* Rol (solo para no-owner) */}
            {!ownerEditing && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rol</Label>
                  <Select value={form.rol} onValueChange={handleRolChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value}>
                          <div className="flex items-center gap-2">
                            <r.icon className="w-4 h-4" />
                            <span>{r.label}</span>
                            <span className="text-xs text-muted-foreground">— {r.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Permisos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Permisos de modulos</Label>
                    <span className="text-xs text-muted-foreground">{form.permisos.length} de {MODULOS_SISTEMA.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {MODULOS_SISTEMA.map(mod => (
                      <label
                        key={mod.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={form.permisos.includes(mod.id)}
                          onCheckedChange={() => togglePermiso(mod.id)}
                        />
                        <span className="text-xs">{mod.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setForm(f => ({ ...f, permisos: MODULOS_SISTEMA.map(m => m.id) }))}>
                      Todos
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setForm(f => ({ ...f, permisos: [] }))}>
                      Ninguno
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm" disabled={saving}>Cancelar</Button></DialogClose>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.nombreCompleto.trim() || (!editingId && form.password.length < 8)}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {ownerEditing ? 'Guardar cambios' : (editingId ? 'Guardar cambios' : 'Crear usuario')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ DIALOG: ELIMINAR / SUSPENDER ═══════════ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Suspender usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Vas a suspender a <strong>{deletingUser?.nombreCompleto || 'este usuario'}</strong>.
            El usuario no podra acceder al sistema pero sus datos se conservan.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm" disabled={deleting}>Cancelar</Button></DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
              Suspender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ DIALOG: MATRIZ DE PERMISOS ═══════════ */}
      <Dialog open={permisosDialogOpen} onOpenChange={setPermisosDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Matriz de Permisos por Rol
            </DialogTitle>
            <DialogDescription>
              Definí qué módulos puede acceder cada rol. Los cambios se aplican a todos los usuarios activos de cada rol.
              <br />El rol <strong>Owner</strong> siempre tiene acceso completo.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs uppercase tracking-wider sticky left-0 bg-background">Módulo</th>
                  {ROLES.map(r => (
                    <th key={r.value} className="text-center p-2 min-w-[90px]">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${r.avatarGradient} flex items-center justify-center text-white shadow-sm`}>
                          <r.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-medium" style={{ color: r.colorHex }}>{r.shortLabel}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULOS_SISTEMA.map(mod => (
                  <tr key={mod.id} className="group">
                    <td className="p-2 font-medium text-sm border-b border-muted/50 sticky left-0 bg-background group-hover:bg-muted/30 transition-colors">
                      {mod.label}
                    </td>
                    {ROLES.map(r => {
                      const checked = (matrixPermisos[r.value] || []).includes(mod.id);
                      const isOwnerCol = r.value === 'owner';
                      const isReadOnly = READ_ONLY_PERMISOS[r.value]?.includes(mod.id);
                      const canEditCell = esAdminOOwner && !isOwnerCol;

                      let cellClass = 'bg-gray-100 text-gray-400';
                      if (checked && isReadOnly) cellClass = 'bg-amber-100 text-amber-700';
                      else if (checked) cellClass = 'bg-emerald-100 text-emerald-700';

                      return (
                        <td key={r.value} className="text-center p-2 border-b border-muted/50">
                          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${cellClass}`}>
                            {canEditCell ? (
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleMatrixPermiso(r.value, mod.id)}
                                className="border-current"
                              />
                            ) : (
                              checked ? (
                                isReadOnly ? (
                                  <span className="text-[10px] font-bold">R</span>
                                ) : (
                                  <Check className="w-4 h-4" />
                                )
                              ) : (
                                <span className="text-xs">—</span>
                              )
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 inline-block border border-emerald-300" />
              Acceso completo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-100 inline-block border border-amber-300 flex items-center justify-center text-[8px] font-bold text-amber-700">R</span>
              Solo lectura
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gray-100 inline-block border border-gray-300" />
              Sin acceso
            </span>
            {!esAdminOOwner && (
              <span className="text-amber-600 ml-auto">Solo owner/admin pueden editar.</span>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={matrixSaving}>Cancelar</Button>
            </DialogClose>
            <Button size="sm" onClick={saveMatrix} disabled={matrixSaving || !esAdminOOwner}>
              {matrixSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Guardar permisos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ DIALOG: INVITAR USUARIO ═══════════ */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-400" />
              Invitar usuario
            </DialogTitle>
            <DialogDescription>
              Creá un nuevo perfil y compartí la contraseña temporal con tu compañero.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre del perfil</Label>
              <Input
                placeholder="Ej: Recepción Laura"
                value={inviteForm.nombre}
                onChange={e => setInviteForm(f => ({ ...f, nombre: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Rol</Label>
              <Select value={inviteForm.rol} onValueChange={v => setInviteForm(f => ({ ...f, rol: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <r.icon className="w-4 h-4" />
                        <span>{r.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <KeyRound className="w-3 h-3" />
                Contraseña temporal
              </Label>
              <div className="flex gap-2">
                <Input
                  value={inviteTempPassword}
                  onChange={e => setInviteTempPassword(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInviteTempPassword(randomPassword())}
                  title="Generar nueva"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Mínimo 8 caracteres, una mayúscula y un número.
              </p>
            </div>

            {/* Permissions preview */}
            <div className="space-y-1.5">
              <Label className="text-xs">Módulos a los que tendrá acceso ({(PERMISOS_POR_ROL[inviteForm.rol] || []).length}/{MODULOS_SISTEMA.length})</Label>
              <div className="rounded-md border p-2.5 bg-muted/20 max-h-40 overflow-y-auto">
                <div className="grid grid-cols-2 gap-1">
                  {MODULOS_SISTEMA.map(m => {
                    const has = (PERMISOS_POR_ROL[inviteForm.rol] || []).includes(m.id);
                    return (
                      <div key={m.id} className="flex items-center gap-1.5 text-xs">
                        {has ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        ) : (
                          <X className="w-3 h-3 text-gray-400 shrink-0" />
                        )}
                        <span className={has ? 'text-foreground' : 'text-muted-foreground line-through'}>
                          {m.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={inviting}>Cancelar</Button>
            </DialogClose>
            <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteForm.nombre.trim() || inviteTempPassword.length < 8}>
              {inviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Enviar invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ DIALOG: RESTABLECER CONTRASEÑA ═══════════ */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              Restablecer contraseña
            </DialogTitle>
            <DialogDescription>
              Generá una nueva contraseña temporal para <strong>{resetTargetUser?.nombreCompleto}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs flex items-center gap-1.5">
              <KeyRound className="w-3 h-3" />
              Nueva contraseña temporal
            </Label>
            <div className="flex gap-2">
              <Input
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResetPassword(randomPassword())}
                title="Generar nueva"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Compartí esta contraseña con el usuario. Podrá cambiarla desde su perfil.
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={resetting}>Cancelar</Button>
            </DialogClose>
            <Button size="sm" onClick={handleReset} disabled={resetting || resetPassword.length < 8}>
              {resetting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Restablecer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
