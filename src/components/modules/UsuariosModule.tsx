'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, UserCog, Pencil, Shield, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Acceso completo a todos los modulos', icon: ShieldCheck, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'recepcion', label: 'Recepcion', description: 'Habitaciones, reservas, check-in y clientes', icon: UserCog, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'limpieza', label: 'Limpieza', description: 'Solo tareas de limpieza y mantenimiento', icon: Shield, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
] as const;

const PERMISOS_POR_ROL: Record<string, ModuloId[]> = {
  admin: ['dashboard', 'habitaciones', 'reservas', 'checkin', 'facturacion', 'limpieza', 'caja', 'clientes', 'reportes', 'usuarios', 'tarifas'],
  recepcion: ['dashboard', 'habitaciones', 'reservas', 'checkin', 'clientes', 'tarifas'],
  limpieza: ['dashboard', 'habitaciones', 'limpieza'],
};

const ROL_LABELS: Record<string, string> = {
  owner: 'Administrador Principal',
  admin: 'Admin',
  recepcion: 'Recepcion',
  limpieza: 'Limpieza',
};

interface UserForm {
  email: string;
  nombreCompleto: string;
  rol: string;
  permisos: ModuloId[];
}

const emptyForm: UserForm = { email: '', nombreCompleto: '', rol: 'recepcion', permisos: ['dashboard', 'habitaciones', 'reservas', 'checkin', 'clientes', 'tarifas'] };

export default function UsuariosModule() {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const [usuarios, setUsuarios] = useState<DbTenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<DbTenantUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const esOwner = usuarioActual?.rol === 'owner';
  const puedeModificar = esOwner || usuarioActual?.permisos.includes('usuarios');

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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (u: DbTenantUser) => {
    // No se puede editar el owner
    if (u.rol === 'owner') {
      toast.error('El Administrador Principal no puede ser modificado');
      return;
    }
    setEditingId(u.id);
    setForm({
      email: u.user?.email || '',
      nombreCompleto: u.nombreCompleto || '',
      rol: u.rol,
      permisos: (u.permisos || []) as ModuloId[],
    });
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
    if (!form.email.trim()) { toast.error('El email es obligatorio'); return; }
    if (!editingId && !form.nombreCompleto.trim()) { toast.error('El nombre es obligatorio'); return; }

    setSaving(true);
    try {
      if (editingId) {
        await api.usuarios.update(editingId, {
          nombreCompleto: form.nombreCompleto.trim() || undefined,
          rol: form.rol,
          permisos: form.permisos,
        });
        toast.success('Usuario actualizado');
      } else {
        await api.usuarios.create({
          email: form.email.trim().toLowerCase(),
          nombreCompleto: form.nombreCompleto.trim(),
          rol: form.rol,
          permisos: form.permisos,
        });
        toast.success('Usuario invitado correctamente');
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
      toast.success('Usuario desactivado');
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const isSelf = (u: DbTenantUser) => u.user?.id === usuarioActual?.id;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Usuarios del hotel</h2>
          <p className="text-sm text-muted-foreground">Gestioná los permisos y roles de tu equipo</p>
        </div>
        {puedeModificar && (
          <Button onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Invitar usuario
          </Button>
        )}
      </div>

      {/* Lista de usuarios */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead className="text-right w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map(u => {
                  const Icon = u.rol === 'owner' ? ShieldCheck : ROLES.find(r => r.value === u.rol)?.icon || Shield;
                  const colorClass = u.rol === 'owner' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : (ROLES.find(r => r.value === u.rol)?.color || '');
                  return (
                    <TableRow key={u.id} className={u.rol === 'owner' ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClass}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {u.nombreCompleto || u.user?.name || 'Sin nombre'}
                              {isSelf(u) && <span className="text-muted-foreground font-normal ml-1">(vos)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{u.user?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.rol === 'owner' ? 'default' : 'outline'} className="text-xs">
                          {ROL_LABELS[u.rol] || u.rol}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground">
                          {u.permisos?.length || 0} de {MODULOS_SISTEMA.length} modulos
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        {u.rol === 'owner' ? (
                          <span className="text-xs text-muted-foreground">No modificable</span>
                        ) : puedeModificar ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {!isSelf(u) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(u)} title="Desactivar">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin permiso</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {usuarios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No hay usuarios. Invitá a tu equipo con el boton de arriba.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Crear/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar usuario' : 'Invitar usuario'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Email (solo lectura en edición) */}
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                disabled={!!editingId}
              />
              {editingId && <p className="text-[11px] text-muted-foreground">El email no se puede cambiar</p>}
            </div>

            {/* Nombre */}
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre completo</Label>
              <Input
                placeholder="Juan Perez"
                value={form.nombreCompleto}
                onChange={e => setForm(f => ({ ...f, nombreCompleto: e.target.value }))}
              />
            </div>

            {/* Rol */}
            <div className="space-y-1.5">
              <Label className="text-xs">Rol</Label>
              <Select value={form.rol} onValueChange={handleRolChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
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
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm" disabled={saving}>Cancelar</Button></DialogClose>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.email.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingId ? 'Guardar cambios' : 'Invitar usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminar */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Desactivar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Vas a desactivar a <strong>{deletingUser?.nombreCompleto || deletingUser?.user?.email}</strong>.
            El usuario no podra acceder al sistema pero sus datos se conservan.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm" disabled={deleting}>Cancelar</Button></DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}