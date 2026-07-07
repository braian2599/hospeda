'use client';

import { useState, useEffect } from 'react';
import { useHotelStore } from '@/lib/store';
import { MODULOS_SISTEMA } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sun, Monitor, Moon, Palette, PanelLeftClose, User, Lock, Save, Rocket, Eye, EyeOff } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileSettings({ open, onOpenChange }: ProfileSettingsProps) {
  const { usuarioActual, usuarios } = useHotelStore();
  const { theme, setTheme } = useTheme();

  const [nombre, setNombre] = useState('');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [sidebarFixed, setSidebarFixed] = useState(false);
  const [startModule, setStartModule] = useState('dashboard');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  useEffect(() => {
    if (open && usuarioActual) {
      setNombre(usuarioActual.nombreCompleto || '');
      setCurrentPass('');
      setNewPass('');
      try {
        const prefs = JSON.parse(localStorage.getItem('hotel-perfil-prefs') || '{}');
        setSidebarFixed(!!prefs.sidebarFixed);
        setStartModule(prefs.startModule || 'dashboard');
      } catch {
        setSidebarFixed(false);
        setStartModule('dashboard');
      }
    }
  }, [open, usuarioActual]);

  const savePrefs = (updates: Record<string, unknown>) => {
    try {
      const prefs = JSON.parse(localStorage.getItem('hotel-perfil-prefs') || '{}');
      Object.assign(prefs, updates);
      localStorage.setItem('hotel-perfil-prefs', JSON.stringify(prefs));
    } catch { /* ignore */ }
  };

  const handleSaveName = () => {
    if (!nombre.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    const { set } = useHotelStore.getState as any;
    const state = useHotelStore.getState();
    const updatedUsers = state.usuarios.map((u: any) =>
      u.id === usuarioActual?.id ? { ...u, nombreCompleto: nombre.trim() } : u
    );
    const updatedSession = usuarioActual ? { ...usuarioActual, nombreCompleto: nombre.trim() } : null;
    set({ usuarios: updatedUsers, usuarioActual: updatedSession });
    toast.success('Nombre actualizado correctamente');
  };

  const handleChangePassword = () => {
    if (!currentPass) {
      toast.error('Ingresá tu contraseña actual');
      return;
    }
    const state = useHotelStore.getState();
    const user = state.usuarios.find((u: any) => u.id === usuarioActual?.id);
    if (!user || user.contrasena !== currentPass) {
      toast.error('Contraseña actual incorrecta');
      return;
    }
    if (!newPass || newPass.length < 3) {
      toast.error('La nueva contraseña debe tener al menos 3 caracteres');
      return;
    }
    const { set } = useHotelStore.getState as any;
    const updatedUsers = state.usuarios.map((u: any) =>
      u.id === usuarioActual?.id ? { ...u, contrasena: newPass } : u
    );
    set({ usuarios: updatedUsers });
    toast.success('Contraseña actualizada correctamente');
    setCurrentPass('');
    setNewPass('');
  };

  const handleSidebarToggle = (checked: boolean) => {
    setSidebarFixed(checked);
    savePrefs({ sidebarFixed: checked });
    window.dispatchEvent(new Event('hotel-prefs-changed'));
    toast.success(checked ? 'Sidebar fija activada' : 'Sidebar fija desactivada');
  };

  const handleStartModule = (value: string) => {
    setStartModule(value);
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
          {/* ── Apariencia ── */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-muted-foreground" />
              Apariencia
            </h3>
            <div>
              <Label className="text-sm mb-2 block">Tema visual</Label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'light', icon: Sun, label: 'Claro', desc: 'Fondo blanco' },
                  { value: 'system', icon: Monitor, label: 'Sistema', desc: 'Automático' },
                  { value: 'dark', icon: Moon, label: 'Oscuro', desc: 'Fondo oscuro' },
                ] as const).map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200
                      ${theme === t.value
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
                      }
                    `}
                  >
                    <t.icon className={`w-6 h-6 ${theme === t.value ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${theme === t.value ? 'text-primary' : 'text-muted-foreground'}`}>
                      {t.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Barra lateral ── */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
              Barra lateral
            </h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
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
              <Button className="gap-2" onClick={handleSaveName}>
                <Save className="w-4 h-4" />
                Guardar nombre
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
                      placeholder="Mínimo 3 caracteres"
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
                <Button variant="outline" className="gap-2" onClick={handleChangePassword}>
                  <Lock className="w-4 h-4" />
                  Cambiar contraseña
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