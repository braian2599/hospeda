'use client';

import { useState, useEffect } from 'react';
import { useHotelStore } from '@/lib/store';
import { MODULOS_SISTEMA } from '@/lib/types';
import { api } from '@/lib/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PanelLeftClose, User, Lock, Save, Rocket, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileSettings({ open, onOpenChange }: ProfileSettingsProps) {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const sidebarFixed = useHotelStore(s => s.sidebarFixed);
  const startModule = useHotelStore(s => s.startModule);
  const setSidebarFixed = useHotelStore(s => s.setSidebarFixed);
  const setStartModule = useHotelStore(s => s.setStartModule);
  const setUsuarioActual = useHotelStore(s => s.setUsuarioActual);

  const [nombre, setNombre] = useState('');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [sidebarFixedLocal, setSidebarFixedLocal] = useState(false);
  const [startModuleLocal, setStartModuleLocal] = useState('dashboard');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    if (open && usuarioActual) {
      setNombre(usuarioActual.nombreCompleto || '');
      setCurrentPass('');
      setNewPass('');
      setSidebarFixedLocal(sidebarFixed);
      setStartModuleLocal(startModule);
    }
  }, [open, usuarioActual, sidebarFixed, startModule]);

  const savePrefs = (updates: Record<string, unknown>) => {
    if ('sidebarFixed' in updates) setSidebarFixed(!!updates.sidebarFixed);
    if ('startModule' in updates) setStartModule(String(updates.startModule));
  };

  const handleSaveName = async () => {
    if (!nombre.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    if (!usuarioActual?.tenantUserId) {
      toast.error('No se pudo identificar tu perfil');
      return;
    }

    setSavingName(true);
    try {
      await api.usuarios.update(usuarioActual.tenantUserId, {
        nombreCompleto: nombre.trim(),
      });
      // Actualizar sesión local
      if (setUsuarioActual && usuarioActual) {
        setUsuarioActual({ ...usuarioActual, nombreCompleto: nombre.trim() });
      }
      toast.success('Nombre actualizado correctamente');
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar nombre');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPass) {
      toast.error('Ingresá tu contraseña actual');
      return;
    }
    if (!newPass || newPass.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSavingPass(true);
    try {
      await api.configuracion.changePassword({
        currentPassword: currentPass,
        newPassword: newPass,
      });
      toast.success('Contraseña actualizada correctamente');
      setCurrentPass('');
      setNewPass('');
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar contraseña');
    } finally {
      setSavingPass(false);
    }
  };

  const handleSidebarToggle = (checked: boolean) => {
    setSidebarFixedLocal(checked);
    savePrefs({ sidebarFixed: checked });
    window.dispatchEvent(new Event('hotel-prefs-changed'));
    toast.success(checked ? 'Sidebar fija activada' : 'Sidebar fija desactivada');
  };

  const handleStartModule = (value: string) => {
    setStartModuleLocal(value);
    savePrefs({ startModule: value });
    toast.success('Módulo de inicio actualizado');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5" />
            Mi Perfil
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configurá tu cuenta y preferencias de uso
          </p>
        </DialogHeader>

        <div className="mt-6 space-y-8">
          {/* ── Barra lateral ── */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
              Barra lateral
            </h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#F1F5F966]">
                <div>
                  <Label className="text-sm font-medium block">Mantener sidebar expandida</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">La barra lateral no se colapsará al sacar el mouse</p>
                </div>
                <Switch checked={sidebarFixed} onCheckedChange={handleSidebarToggle} />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Módulo de inicio</Label>
                <Select value={startModule} onValueChange={handleStartModule}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar módulo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULOS_SISTEMA.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  <Rocket className="w-3 h-3 inline-block mr-1" />
                  Este módulo se cargará automáticamente al iniciar sesión
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Cuenta ── */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4 text-muted-foreground" />
              Cuenta
            </h3>
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium mb-2 block">Nombre completo</Label>
                <Input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Tu nombre completo"
                  className="h-11"
                />
              </div>
              <Button className="gap-2" onClick={handleSaveName} disabled={savingName}>
                {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingName ? 'Guardando...' : 'Guardar nombre'}
              </Button>

              <Separator />

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Contraseña actual</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPass}
                      onChange={e => setCurrentPass(e.target.value)}
                      placeholder="Ingresá tu contraseña actual"
                      className="h-11 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="h-11 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button variant="outline" className="gap-2" onClick={handleChangePassword} disabled={savingPass}>
                  {savingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {savingPass ? 'Cambiando...' : 'Cambiar contraseña'}
                </Button>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="mt-6 pt-4 border-t">
          <DialogClose asChild>
            <Button variant="secondary" className="px-6">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}