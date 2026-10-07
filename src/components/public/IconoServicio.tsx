// El ícono de un servicio de la página web (src/lib/contenido-web.ts). Si el
// hotel no eligió uno, se elige según el nombre.

import {
  Wifi, Coffee, Car, Wind, Flame, Waves, Tv, UtensilsCrossed, CookingPot, Beef, Sparkles, Dumbbell,
  PawPrint, Baby, ConciergeBell, Bus, Shirt, Accessibility, ShieldCheck, Bike, Mountain, Check, Heater,
  type LucideIcon,
} from 'lucide-react';
import { createElement } from 'react';
import { iconoSugerido, type IconoServicio as Id } from '@/lib/contenido-web';

const ICONOS: Record<Id, LucideIcon> = {
  wifi: Wifi, desayuno: Coffee, estacionamiento: Car, aire: Wind, calefaccion: Heater, piscina: Waves,
  tv: Tv, restaurante: UtensilsCrossed, cocina: CookingPot, parrilla: Beef, spa: Sparkles, gimnasio: Dumbbell,
  mascotas: PawPrint, ninos: Baby, recepcion: ConciergeBell, traslados: Bus, lavanderia: Shirt,
  accesible: Accessibility, seguridad: ShieldCheck, bicicletas: Bike, montana: Mountain, otro: Check,
};

export function iconoDeServicio(icono: string, nombre: string): LucideIcon {
  return ICONOS[(icono as Id)] ?? ICONOS[iconoSugerido(nombre)] ?? Flame;
}

export default function IconoServicio({ icono, nombre, className }: { icono: string; nombre: string; className?: string }) {
  return createElement(iconoDeServicio(icono, nombre), { className });
}
