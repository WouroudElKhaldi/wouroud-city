"use client";

import { useEffect } from "react";
import { useCityStore } from "@/state/useCityStore";
import { shopInfo } from "@/world/shops";

/** The menu of a café or restaurant: pick something and it's served at your table. */
export function MenuCard() {
  const menu = useCityStore((s) => s.menu);
  const openMenu = useCityStore((s) => s.openMenu);
  const placeOrder = useCityStore((s) => s.placeOrder);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") openMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, openMenu]);
  if (!menu) return null;
  const info = shopInfo(menu);
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-[#0d0820]/50 p-4" role="dialog" aria-label={`${menu} menu`}>
      <div className="welcome-card w-full max-w-md">
        <p className="text-xs tracking-[0.25em] text-amber-200 uppercase">Menu</p>
        <h2 className="text-2xl font-extrabold text-white">{menu}</h2>
        <ul className="mt-4 space-y-2">
          {(info.menu ?? []).map((item) => (
            <li key={item.name}>
              <button
                type="button"
                onClick={() => placeOrder(menu, item)}
                className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-left text-white transition hover:bg-white/20"
              >
                <span className="h-5 w-5 shrink-0 rounded-full border border-white/40" style={{ background: item.color }} />
                <span className="flex-1">
                  <span className="font-bold">{item.name}</span>
                  {item.note && <span className="block text-sm text-violet-200">{item.note}</span>}
                </span>
                <span className="font-bold text-amber-200">{item.price}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button type="button" className="hud-chip text-white" onClick={() => openMenu(null)}>
            Not now <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
