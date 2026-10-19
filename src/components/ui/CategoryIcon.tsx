"use client";

import React from "react";
import {
  Fuel,
  Home,
  Zap,
  Utensils,
  ShoppingCart,
  Smartphone,
  ShoppingBag,
  HeartPulse,
  Bus,
  CreditCard,
  MoreHorizontal,
  Wallet,
  Building,
  Tag,
  ArrowRightLeft,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Fuel,
  Home,
  Zap,
  Utensils,
  ShoppingCart,
  Smartphone,
  ShoppingBag,
  HeartPulse,
  Bus,
  CreditCard,
  MoreHorizontal,
  Wallet,
  Building,
  Tag,
  ArrowRightLeft,
  DollarSign,
};

interface CategoryIconProps {
  iconName: string;
  color?: string;
  size?: number;
  className?: string;
}

export function CategoryIcon({
  iconName,
  color,
  size = 18,
  className = "",
}: CategoryIconProps) {
  const IconComponent = ICON_MAP[iconName] || Tag;

  return (
    <div
      className={`flex items-center justify-center rounded-xl shrink-0 transition-colors ${className}`}
      style={{
        backgroundColor: "#EFF5FF",
        color: "#1E5BFF",
        width: size + 18,
        height: size + 18,
      }}
      aria-hidden="true"
    >
      <IconComponent size={size} strokeWidth={2.2} />
    </div>
  );
}
