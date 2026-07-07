'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import { MODULOS_SISTEMA } from '@/lib/types';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, UserCog, Pencil, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface UserForm {
  nombre: string;
  nombreCompleto: string;
  contrasena: string;
  permisos: string[];
}

const emptyForm: UserForm = { nombre: '', nombreCompleto: '', contrasena: '', permisos: [] };

export default function UsuariosModule() {
  const { usuarios, usuarioActual, crearUsuario, actualizarUsuario, eliminarUsuario } = useHotelStore();

  // Modal state: 'crear' | 'editar' | 'eliminar' | null
  const [modal, setModal] = useState<'crear' | 'editar' | 'eliminar' | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>({ ...emptyForm });
  const [deleteError, setDeleteError] = useState('');

  // ==================== HANDLERS ====================

  const openCreate = () => {
    setForm({ ...emptyForm });
    setSelId(null);
    setDeleteError('');
    setModal('crear');
  };

  const openEdit = (id: number) => {
    const u = usuarios.find(x => x.id === id);
    if (!u) return;
    setSelId(id);
    setForm({
      nombre: u.nombre,
      nombreCompleto: u.nombreCompleto,
      contrasena: '',
      permisos: [...u.permisos],
    });
    setDeleteError('');
    setModal('editar');
  };

  const openDelete = (id: number) => {
    const u = usuarios.find(x => x.id === id);
    if (!u) return;
    // Prevent deleting admin
    if (u.nombre === 'admin') {
      setDeleteError('El usuario "admin" está protegido y no puede ser eliminado.');
      return;
    }
    setSelId(id);
    setDeleteError('');
    setModal('eliminar');
  };

  const handleSave = () => {
    if (!form.nombre.trim()) return;

    if (modal === 'crear') {
      if (!form.contrasena.trim()) return;
      crearUsuario({
        nombre: form.nombre.trim(),
        contrasena: form.contrasena,
        nombreCompleto: form.nombreCompleto.trim() || form.nombre.trim(),
        permisos: form.permisos,
      });
    } else if (modal === 'editar' && selId !== null) {
      const datos: Partial<{ nombre: string; nombreCompleto: string; contrasena: string; permisos: string[] }> = {
        nombreCompleto: form.nombreCompleto.trim(),
        permisos: form.permisos,
      };
      if (form.contrasena.trim()) {
        datos.contrasena = form.contrasena;
      }
      actualizarUsuario(selId, datos);
    }

    toast.success('Usuario guardado', { description: form.nombreCompleto || form.nombre });
    setModal(null);
  };

  const handleDelete = () => {
    if (selId === null) return;

    // Prevent self-delete
    if (usuarioActual && usuarioActual.id === selId) {
      setDeleteError('No puedes eliminar tu propia cuenta de usuario.');
      return;
    }

    // Prevent deleting last admin (user with 'usuarios' permission)
    const target = usuarios.find(u => u.id === selId);
    if (target) {
      const admins = usuarios.filter(u => u.id !== selId && u.permisos.includes('usuarios'));
      if (admins.length === 0 && target.permisos.includes('usuarios')) {
        setDeleteError('No se puede eliminar al último administrador del sistema.');
        return;
      }
    }

    eliminarUsuario(selId);
    toast.success('Usuario eliminado');
    setModal(null);
  };

  const togglePermiso = (moduloId: string) => {
    setForm(prev => ({
      ...prev,
      permisos: prev.permisos.includes(moduloId)
        ? prev.permisos.filter(p => p !== moduloId)
        : [...prev.permisos, moduloId],
    }));
  };

  const selectAllPermisos = () => {
    setForm(prev => ({
      ...prev,
      permisos: MODULOS_SISTEMA.map(m => m.id),
    }));
  };

  const deselectAllPermisos = () => {
    setForm(prev => ({ ...prev, permisos: [] }));
  };

  const selected = usuarios.find(u => u.id === selId);

  const isAdmin = selId !== null && usuarios.find(u => u.id === selId)?.nombre === 'admin';

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center"><UserCog className="w-5 h-5 text-cyan-500" /></div>
          Gestión de Usuarios
        </h2>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          Crear Usuario
        </Button>
      </div>

      {/* Users Table */}
      {usuarios.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay usuarios registrados.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead className="hidden sm:table-cell">Nombre Completo</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {u.nombre}
                      {u.nombre === 'admin' && (
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" title="Usuario protegido" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{u.nombreCompleto}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.permisos.length} módulo{u.permisos.length !== 1 ? 's' : ''}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEdit(u.id)}
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDelete(u.id)}
                        disabled={u.nombre === 'admin'}
                        title={u.nombre === 'admin' ? 'Protegido' : 'Eliminar'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ==================== DIALOG: Crear / Editar ==================== */}
      <Dialog
        open={modal === 'crear' || modal === 'editar'}
        onOpenChange={() => setModal(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modal === 'crear' ? 'Crear Usuario' : 'Editar Usuario'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Username */}
            <div className="grid gap-1.5">
              <Label htmlFor="user-nombre">Usuario *</Label>
              <Input
                id="user-nombre"
                placeholder="nombre_usuario"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                readOnly={isAdmin}
                className={isAdmin ? 'bg-muted cursor-not-allowed' : ''}
              />
              {isAdmin && (
                <p className="text-xs text-muted-foreground">El nombre de usuario &quot;admin&quot; no se puede modificar.</p>
              )}
            </div>

            {/* Full Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="user-nombrecompleto">Nombre Completo</Label>
              <Input
                id="user-nombrecompleto"
                placeholder="Nombre visible del empleado"
                value={form.nombreCompleto}
                onChange={e => setForm({ ...form, nombreCompleto: e.target.value })}
              />
            </div>

            {/* Password */}
            <div className="grid gap-1.5">
              <Label htmlFor="user-contrasena">
                Contraseña {modal === 'editar' ? '(dejar vacío para mantener)' : '*'}
              </Label>
              <Input
                id="user-contrasena"
                type="password"
                placeholder={modal === 'editar' ? '••••••••' : 'Contraseña'}
                value={form.contrasena}
                onChange={e => setForm({ ...form, contrasena: e.target.value })}
              />
            </div>

            <Separator />

            {/* Permissions */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Permisos de Acceso</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllPermisos}>
                    Todos
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAllPermisos}>
                    Ninguno
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {MODULOS_SISTEMA.map(modulo => (
                  <label
                    key={modulo.id}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={form.permisos.includes(modulo.id)}
                      onCheckedChange={() => togglePermiso(modulo.id)}
                    />
                    <span className="text-sm leading-none">{modulo.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.permisos.length} de {MODULOS_SISTEMA.length} módulos seleccionados
              </p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={
                !form.nombre.trim() ||
                (modal === 'crear' && !form.contrasena.trim())
              }
            >
              {modal === 'crear' ? 'Crear' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG: Eliminar ==================== */}
      <Dialog open={modal === 'eliminar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Eliminar Usuario</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-3">
              <p>
                ¿Está seguro de eliminar al usuario{' '}
                <strong>&quot;{selected.nombre}&quot;</strong>?
              </p>
              {selected.nombreCompleto && selected.nombreCompleto !== selected.nombre && (
                <p className="text-sm text-muted-foreground">
                  ({selected.nombreCompleto})
                </p>
              )}

              {selected.permisos.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Tiene acceso a <Badge variant="secondary">{selected.permisos.length} módulo{selected.permisos.length !== 1 ? 's' : ''}</Badge>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Esta acción no se puede deshacer.
              </p>

              {deleteError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-sm text-destructive flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    {deleteError}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!!deleteError || (selected?.nombre === 'admin')}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}