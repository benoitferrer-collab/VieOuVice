"use client";
import {
  Footprints,
  Moon,
  Activity,
  Leaf,
  Wine,
  Pizza,
  Smartphone,
  Coffee,
  Zap,
  Flame,
} from "lucide-react";
const icons = {
  flame: Flame,
  footprints: Footprints,
  moon: Moon,
  activity: Activity,
  leaf: Leaf,
  wine: Wine,
  pizza: Pizza,
  phone: Smartphone,
  coffee: Coffee,
};

export function ActionIcon({
  name,
  size = 21,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name as keyof typeof icons] || Zap;
  return <Icon size={size} />;
}
