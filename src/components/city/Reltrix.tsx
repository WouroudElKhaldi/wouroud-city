"use client";

import { Text } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { playerState } from "@/world/env";
import { sfx } from "@/world/sfx";
import { Block, plain } from "./Furniture";
import { finishes } from "./luxury";
import { box, dots, font, Panel, useCanvas, wrap } from "./roomKit";
import { rng, walk, type Candle } from "./TradingFloor";
import { useProximity } from "./useProximity";

/**
 * Reltrix, the trading-technology infrastructure Wouroud's team builds (SAHMEE Technology
 * is its UK brand in the region). Its products stand on the Sahme trading floor as screen
 * totems drawn in Reltrix's look (near-black, cyan), and the engineering department shows
 * the ecosystem and the SAHMEE Group entities. Content from reltrix.com, sahmee.com and the
 * Reltrix expo brochure.
 */

export const RX = {
  bg: "#070b14",
  panel: "#0e1726",
  line: "#1c2a3d",
  cyan: "#22c7d9",
  cyanDark: "#0e9fb3",
  text: "#e8eef6",
  grey: "#8b9bb0",
  up: "#22c55e",
  down: "#ef4444",
  purple: "#8b5cf6",
};

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** The Reltrix wordmark: cyan, with circuit dots under the R. */
export function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = RX.cyan;
  ctx.font = font(size, "bold");
  ctx.fillText("Reltrix", x, y);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + size * (0.08 + i * 0.12), y + size * 0.18, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
}

function frame(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, subtitle: string) {
  ctx.fillStyle = RX.bg;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.85, h * 0.1, 0, w * 0.85, h * 0.1, w * 0.7);
  g.addColorStop(0, "rgba(34,199,217,0.16)");
  g.addColorStop(1, "rgba(34,199,217,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  drawLogo(ctx, 30, 52, 34);
  ctx.fillStyle = RX.text;
  ctx.font = font(40, "bold");
  ctx.fillText(title, 30, 112);
  ctx.fillStyle = RX.grey;
  ctx.font = font(21);
  ctx.fillText(subtitle, 30, 144);
}

function candles(ctx: CanvasRenderingContext2D, data: Candle[], x: number, y: number, w: number, h: number) {
  const hi = Math.max(...data.map((c) => c.h));
  const lo = Math.min(...data.map((c) => c.l));
  const py = (v: number) => y + h - ((v - lo) / (hi - lo || 1)) * h;
  const step = w / data.length;
  data.forEach((c, i) => {
    const cx = x + i * step + step / 2;
    ctx.strokeStyle = ctx.fillStyle = c.c >= c.o ? RX.up : RX.down;
    ctx.beginPath();
    ctx.moveTo(cx, py(c.h));
    ctx.lineTo(cx, py(c.l));
    ctx.stroke();
    ctx.fillRect(cx - step * 0.3, Math.min(py(c.o), py(c.c)), step * 0.6, Math.max(2, Math.abs(py(c.o) - py(c.c))));
  });
}

function drawWebTrader(ctx: CanvasRenderingContext2D, w: number, h: number) {
  frame(ctx, w, h, "Web Trader", "Multi-asset terminal · web, desktop & mobile (PWA)");
  const top = 170;
  box(ctx, 24, top, w - 48, h - top - 24, 10, RX.panel, RX.line);
  ["XAU/USD", "BTC/USD", "EUR/USD", "GBP/JPY", "US30"].forEach((p, i) => {
    box(ctx, 36 + i * 128, top + 12, 118, 34, 6, i === 0 ? "#13324a" : "#111c2c");
    ctx.fillStyle = i === 0 ? RX.cyan : RX.grey;
    ctx.font = font(17, "bold");
    ctx.fillText(p, 50 + i * 128, top + 35);
  });
  candles(ctx, walk(40, 2380, 6, rng(11)), 40, top + 70, w * 0.62, h - top - 190);
  const ox = w * 0.7;
  box(ctx, ox, top + 60, w * 0.27, h - top - 180, 8, "#0b1320", RX.line);
  ctx.fillStyle = RX.text;
  ctx.font = font(20, "bold");
  ctx.fillText("New order", ox + 16, top + 92);
  box(ctx, ox + 16, top + 110, w * 0.11, 52, 6, RX.down);
  box(ctx, ox + 26 + w * 0.12, top + 110, w * 0.11, 52, 6, RX.up);
  ctx.fillStyle = "#fff";
  ctx.font = font(18, "bold");
  ctx.fillText("SELL", ox + 36, top + 143);
  ctx.fillText("BUY", ox + 50 + w * 0.12, top + 143);
  ctx.fillStyle = RX.grey;
  ctx.font = font(16);
  ["Volume   1.00 lot", "Stop loss    2371.20", "Take profit  2394.80"].forEach((t, i) => ctx.fillText(t, ox + 16, top + 198 + i * 30));
  ctx.fillStyle = RX.grey;
  ctx.font = font(15);
  ctx.fillText("Open tickets 3 · Orders 0 · Trading history", 40, h - 70);
  ctx.fillStyle = RX.cyan;
  ctx.font = font(20, "bold");
  ctx.fillText("6 markets · 700+ instruments · 100+ indicators", 40, h - 40);
}

function drawInvestTrader(ctx: CanvasRenderingContext2D, w: number, h: number) {
  frame(ctx, w, h, "Invest Trader", "Social trading: copy trading, PAMM and MAM");
  const leaders: [string, number, string][] = [
    ["Atlas FX", 38.4, "1.2k"],
    ["Gold Hunter", 27.1, "860"],
    ["Steady Swing", 14.9, "2.4k"],
  ];
  leaders.forEach(([name, ret, followers], i) => {
    const x = 30 + i * ((w - 60) / 3);
    const cw = (w - 60) / 3 - 18;
    box(ctx, x, 180, cw, 250, 10, RX.panel, RX.line);
    ctx.fillStyle = RX.cyanDark;
    ctx.beginPath();
    ctx.arc(x + 40, 222, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = RX.text;
    ctx.font = font(20, "bold");
    ctx.fillText(name, x + 74, 230);
    ctx.fillStyle = RX.up;
    ctx.font = font(36, "bold");
    ctx.fillText(`+${ret}%`, x + 20, 296);
    ctx.fillStyle = RX.grey;
    ctx.font = font(16);
    ctx.fillText(`12-month return · ${followers} copiers`, x + 20, 326);
    ctx.strokeStyle = RX.up;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const r = rng(i + 3);
    for (let k = 0; k <= 12; k++) {
      const px = x + 20 + (k / 12) * (cw - 40);
      const py = 380 - k * (ret / 12) * 0.9 + (r() - 0.5) * 12;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    box(ctx, x + cw - 110, 196, 90, 34, 6, RX.cyan);
    ctx.fillStyle = RX.bg;
    ctx.font = font(16, "bold");
    ctx.fillText("Copy", x + cw - 86, 219);
  });
  [
    ["3x", "client retention"],
    ["5x", "trading volume"],
    ["30%+", "AUM growth potential"],
  ].forEach(([n, t], i) => {
    const x = 40 + i * ((w - 60) / 3);
    ctx.fillStyle = RX.cyan;
    ctx.font = font(44, "bold");
    ctx.fillText(n, x, h - 72);
    ctx.fillStyle = RX.grey;
    ctx.font = font(18);
    ctx.fillText(t, x, h - 40);
  });
}

/** AI Trader's market-sentiment bubbles; `t` animates them. */
function drawAiTrader(ctx: CanvasRenderingContext2D, w: number, h: number, t = 0) {
  frame(ctx, w, h, "AI Trader", "AI-assisted market sentiment, in colour-coded bubbles");
  box(ctx, 24, 170, w - 48, h - 194, 10, "#0a0f1c", RX.line);
  const bubbles: [string, string, number, number, number, string][] = [
    ["CHF/JPY", "HOT BUY", 0.28, 0.5, 74, RX.up],
    ["GBP/JPY", "HOT SELL", 0.5, 0.68, 70, RX.down],
    ["EUR/USD", "BUY", 0.44, 0.36, 46, RX.up],
    ["XAU/USD", "STRONG", 0.64, 0.4, 52, RX.purple],
    ["BTC/USD", "SELL", 0.72, 0.66, 44, RX.down],
    ["US30", "NEUTRAL", 0.36, 0.76, 36, RX.purple],
    ["ETH/USD", "BUY", 0.58, 0.82, 34, RX.up],
    ["AUD/USD", "SELL", 0.2, 0.74, 32, RX.down],
    ["NAS100", "BUY", 0.78, 0.3, 36, RX.up],
  ];
  bubbles.forEach(([pair, tag, bx, by, r0, color], i) => {
    const r = r0 * (1 + Math.sin(t * 1.6 + i) * 0.05);
    const x = 24 + bx * (w * 0.72);
    const y = 170 + by * (h - 194);
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.5);
    g.addColorStop(0, color + "55");
    g.addColorStop(1, color + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0d1426";
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = RX.text;
    ctx.font = font(Math.max(13, r * 0.3), "bold");
    ctx.fillText(pair, x, y);
    ctx.fillStyle = color;
    ctx.font = font(Math.max(11, r * 0.22), "bold");
    ctx.fillText(tag, x, y + r * 0.32);
    ctx.textAlign = "left";
  });
  const sx = w * 0.78;
  box(ctx, sx, 190, w * 0.19, h - 234, 8, RX.panel, RX.line);
  ctx.fillStyle = RX.text;
  ctx.font = font(18, "bold");
  ctx.fillText("Signal", sx + 14, 222);
  ctx.fillStyle = RX.up;
  ctx.font = font(26, "bold");
  ctx.fillText("BUY", sx + 14, 262);
  ctx.fillStyle = RX.grey;
  ctx.font = font(15);
  ["Momentum  ▲", "RSI  62", "Sentiment 71%"].forEach((s, i) => ctx.fillText(s, sx + 14, 300 + i * 28));
  box(ctx, sx + 14, h - 110, w * 0.19 - 28, 44, 6, RX.up);
  ctx.fillStyle = "#04130a";
  ctx.font = font(17, "bold");
  ctx.fillText("Trade now", sx + 30, h - 81);
}

function drawProp(ctx: CanvasRenderingContext2D, w: number, h: number) {
  frame(ctx, w, h, "Prop Trading", "Challenges, evaluations and funded accounts");
  ["Phase 1", "Phase 2", "Funded"].forEach((p, i) => {
    const x = 30 + i * 210;
    box(ctx, x, 172, 190, 40, 20, i === 0 ? RX.cyan : RX.panel, RX.line);
    ctx.fillStyle = i === 0 ? RX.bg : RX.grey;
    ctx.font = font(18, "bold");
    ctx.fillText(`${i + 1}. ${p}`, x + 30, 199);
  });
  ctx.fillStyle = RX.text;
  ctx.font = font(22);
  ctx.fillText("Account balance", 30, 260);
  ctx.font = font(44, "bold");
  ctx.fillText("$104,860.20", 30, 308);
  const rules: [string, number, number, string][] = [
    ["Profit target 8%", 0.61, 1, RX.up],
    ["Max daily loss 5%", 0.22, 1, "#f59e0b"],
    ["Max loss 10%", 0.14, 1, "#f59e0b"],
    ["Trading days 4 / 5", 0.8, 1, RX.cyan],
  ];
  rules.forEach(([label, v], i) => {
    const y = 350 + i * 52;
    ctx.fillStyle = RX.grey;
    ctx.font = font(17);
    ctx.fillText(label, 30, y);
    box(ctx, 260, y - 16, w * 0.45, 18, 9, "#16233a");
    box(ctx, 260, y - 16, w * 0.45 * v, 18, 9, rules[i][3]);
  });
  const ax = w * 0.74;
  box(ctx, ax, 240, w * 0.23, 210, 10, "#2a1414", RX.down);
  ctx.fillStyle = RX.down;
  ctx.font = font(19, "bold");
  ctx.fillText("Real-time risk", ax + 16, 274);
  ctx.fillStyle = RX.text;
  ctx.font = font(16);
  wrap(ctx, "Rule breach alert: daily drawdown 4.6% on #40213. Auto-close armed.", ax + 16, 306, w * 0.2, 24);
}

function drawCrm(ctx: CanvasRenderingContext2D, w: number, h: number) {
  frame(ctx, w, h, "CRM & Back Office", "Client lifecycle, KYC/AML, payments and reporting");
  const rows: [string, string, string, string][] = [
    ["A. Haddad", "KYC approved", "$12,400", RX.up],
    ["R. Saleh", "Docs pending", "$0", "#f59e0b"],
    ["J. Martin", "KYC approved", "$5,250", RX.up],
    ["N. Khoury", "AML review", "$900", RX.purple],
    ["L. Chen", "KYC approved", "$31,020", RX.up],
  ];
  box(ctx, 24, 170, w * 0.6, h - 194, 10, RX.panel, RX.line);
  ctx.fillStyle = RX.grey;
  ctx.font = font(16, "bold");
  ["Client", "Status", "Deposits"].forEach((c, i) => ctx.fillText(c, 44 + i * 210, 204));
  rows.forEach(([n, st, dep, color], i) => {
    const y = 250 + i * 54;
    ctx.fillStyle = RX.text;
    ctx.font = font(19);
    ctx.fillText(n, 44, y);
    box(ctx, 250, y - 22, 150, 30, 15, color + "33");
    ctx.fillStyle = color;
    ctx.font = font(15, "bold");
    ctx.fillText(st, 262, y - 2);
    ctx.fillStyle = RX.text;
    ctx.font = font(19);
    ctx.fillText(dep, 464, y);
  });
  const fx = w * 0.66;
  ctx.fillStyle = RX.text;
  ctx.font = font(20, "bold");
  ctx.fillText("Sales funnel", fx, 204);
  [
    ["Leads", 1, 3120],
    ["Registered", 0.7, 2180],
    ["KYC passed", 0.48, 1490],
    ["Funded", 0.3, 930],
  ].forEach(([l, v, n], i) => {
    const bw = (w * 0.3) * (v as number);
    box(ctx, fx + (w * 0.3 - bw) / 2, 226 + i * 66, bw, 50, 6, i === 3 ? RX.cyan : "#16334a");
    ctx.fillStyle = i === 3 ? RX.bg : RX.text;
    ctx.font = font(16, "bold");
    ctx.textAlign = "center";
    ctx.fillText(`${l} · ${n}`, fx + w * 0.15, 258 + i * 66);
    ctx.textAlign = "left";
  });
}

function drawOms(ctx: CanvasRenderingContext2D, w: number, h: number) {
  frame(ctx, w, h, "Order Management (OMS)", "Multi-LP aggregation and smart order routing");
  const lps = ["LP 1 · Tier-1 bank", "LP 2 · Prime of prime", "LP 3 · Crypto venue", "LP 4 · Exchange"];
  lps.forEach((l, i) => {
    box(ctx, 30, 190 + i * 78, 250, 58, 8, RX.panel, RX.line);
    ctx.fillStyle = RX.text;
    ctx.font = font(17);
    ctx.fillText(l, 46, 226 + i * 78);
  });
  const cx = w * 0.42;
  box(ctx, cx, 250, w * 0.2, 170, 12, "#0f2a3a", RX.cyan, 3);
  ctx.fillStyle = RX.cyan;
  ctx.font = font(26, "bold");
  ctx.fillText("OMS", cx + 24, 292);
  ctx.fillStyle = RX.text;
  ctx.font = font(15);
  ["Smart routing", "Markup & spread", "A/B book"].forEach((t, i) => ctx.fillText(t, cx + 24, 326 + i * 26));
  ["Web Trader", "MT4 / MT5", "Mobile"].forEach((t, i) => {
    box(ctx, w * 0.74, 210 + i * 96, 220, 60, 8, RX.panel, RX.line);
    ctx.fillStyle = RX.text;
    ctx.font = font(18);
    ctx.fillText(t, w * 0.74 + 20, 248 + i * 96);
  });
  ctx.strokeStyle = RX.cyan;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(280, 219 + i * 78);
    ctx.lineTo(cx, 335);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.2, 335);
    ctx.lineTo(w * 0.74, 240 + i * 96);
    ctx.stroke();
  }
}

function drawBridge(ctx: CanvasRenderingContext2D, w: number, h: number) {
  frame(ctx, w, h, "Bridge & Connectivity", "MT4 / MT5 bridge, FIX API gateway, price feeds");
  [
    ["MT4/MT5 bridge", "connected"],
    ["FIX API gateway", "4.4 · 12 sessions"],
    ["Price feed aggregation", "38 symbols streaming"],
  ].forEach(([n, s], i) => {
    box(ctx, 30, 180 + i * 86, w * 0.52, 68, 10, RX.panel, RX.line);
    ctx.fillStyle = RX.up;
    ctx.beginPath();
    ctx.arc(60, 214 + i * 86, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = RX.text;
    ctx.font = font(21, "bold");
    ctx.fillText(n, 84, 210 + i * 86);
    ctx.fillStyle = RX.grey;
    ctx.font = font(15);
    ctx.fillText(s, 84, 234 + i * 86);
  });
  const gx = w * 0.6;
  box(ctx, gx, 180, w * 0.36, 240, 10, RX.panel, RX.line);
  ctx.fillStyle = RX.grey;
  ctx.font = font(16);
  ctx.fillText("Execution latency (ms)", gx + 18, 210);
  ctx.strokeStyle = RX.cyan;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const r = rng(5);
  for (let k = 0; k <= 30; k++) {
    const x = gx + 18 + (k / 30) * (w * 0.36 - 36);
    const y = 380 - r() * 40 - 60;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = RX.cyan;
  ctx.font = font(48, "bold");
  ctx.fillText("0.8 ms", gx + 18, 410);
  ctx.fillStyle = RX.grey;
  ctx.font = font(18);
  ctx.fillText("Sub-millisecond execution", 30, h - 40);
}

function drawPlugins(ctx: CanvasRenderingContext2D, w: number, h: number) {
  frame(ctx, w, h, "Plug-ins", "Add-ons for engagement, retention and revenue");
  [
    ["Social Trading", "Follow and copy strategies"],
    ["PAMM", "Pooled money management"],
    ["IB / Affiliates Portal", "Partners, commissions, payouts"],
    ["Risk Management", "Exposure, alerts, limits"],
  ].forEach(([n, d], i) => {
    const x = 30 + (i % 2) * ((w - 60) / 2);
    const y = 180 + Math.floor(i / 2) * 150;
    box(ctx, x, y, (w - 60) / 2 - 16, 130, 12, RX.panel, RX.line);
    box(ctx, x + 18, y + 20, 46, 46, 10, "#0f2a3a", RX.cyan);
    ctx.fillStyle = RX.cyan;
    ctx.font = font(26, "bold");
    ctx.fillText("+", x + 32, y + 53);
    ctx.fillStyle = RX.text;
    ctx.font = font(22, "bold");
    ctx.fillText(n, x + 80, y + 50);
    ctx.fillStyle = RX.grey;
    ctx.font = font(16);
    ctx.fillText(d, x + 80, y + 82);
  });
}

function drawEcosystem(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = RX.bg;
  ctx.fillRect(0, 0, w, h);
  drawLogo(ctx, 30, 56, 36);
  ctx.fillStyle = RX.text;
  ctx.font = font(40, "bold");
  ctx.fillText("Build. Plug. Launch.", 30, 120);
  ctx.fillStyle = RX.grey;
  ctx.font = font(19);
  ctx.fillText("Pre-integrated partner ecosystem", 30, 152);
  const groups: [string, string[]][] = [
    ["Trading platforms", ["MT4/MT5", "TradeLocker", "cTrader", "VERTEX", "Match-Trader"]],
    ["Payments", ["Binance Pay", "BOF Pay", "Coinkade", "PayRetailers", "Paystack"]],
    ["Identity", ["Sumsub", "Shufti Pro"]],
    ["Liquidity", ["EXANTE", "Global DTT", "BOF Prime", "ATFX Connect"]],
    ["Technology", ["TradingView", "PrimeXM", "Spencer Logic"]],
  ];
  let y = 200;
  for (const [title, names] of groups) {
    ctx.fillStyle = RX.cyan;
    ctx.font = font(17, "bold");
    ctx.fillText(title.toUpperCase(), 30, y);
    let x = 30;
    y += 14;
    ctx.font = font(17);
    for (const n of names) {
      const tw = ctx.measureText(n).width + 28;
      if (x + tw > w - 30) {
        x = 30;
        y += 44;
      }
      box(ctx, x, y, tw, 34, 17, RX.panel, RX.line);
      ctx.fillStyle = RX.text;
      ctx.fillText(n, x + 14, y + 23);
      x += tw + 10;
    }
    y += 70;
  }
}

function drawGroup(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0b1c33");
  g.addColorStop(1, "#061224");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  dots(ctx, 20, 20, 60, 24, 24, "rgba(255,255,255,0.04)");
  ctx.fillStyle = "#fff";
  ctx.font = font(54, "bold");
  ctx.fillText("sahmee", 40, 80);
  ctx.font = font(15, "bold");
  ctx.fillText("G R O U P", 120, 102);
  ctx.font = font(34, "bold");
  ctx.fillText("Where innovation meets global finance.", 300, 82);
  const entities: [string, string, string][] = [
    ["SAHMEE Trading", "Regulated in Vanuatu", "Multi-asset broker: forex, equities, gold, CFDs and crypto, with instant funding."],
    ["SAHMEE AI", "Licensed in Bahrain", "AI trading signals: 200+ indicators, up to 82% win rate, 22+ trades a day."],
    ["SAHMEE Pay", "Regulated in Oman", "Borderless banking and cross-border payments across the GCC, with Uptex."],
    ["SAHMEE Technology", "Licensed in the UK", "Reltrix Technologies' brand in the region: our team builds it."],
    ["SAHMEE Consulting", "SCA regulated in the UAE", "Launching and scaling financial-services businesses, with Direct TT."],
  ];
  entities.forEach(([name, reg, text], i) => {
    const cw = (w - 80 - 4 * 16) / 5;
    const x = 40 + i * (cw + 16);
    const tech = i === 3;
    box(ctx, x, 140, cw, h - 180, 14, tech ? "#0f2a3a" : "rgba(255,255,255,0.05)", tech ? RX.cyan : "rgba(30,160,230,0.4)", tech ? 3 : 2);
    ctx.fillStyle = tech ? RX.cyan : "#1ea0e6";
    ctx.font = font(23, "bold");
    ctx.fillText(name, x + 18, 186);
    ctx.fillStyle = "#93c5fd";
    ctx.font = font(15, "bold");
    ctx.fillText(reg.toUpperCase(), x + 18, 214);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = font(18);
    wrap(ctx, text, x + 18, 256, cw - 36, 26);
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

type Product = { key: string; name: string; draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t?: number) => void; about: string };

export const PRODUCTS: Product[] = [
  { key: "web", name: "Web Trader", draw: drawWebTrader, about: "Fully brandable multi-asset terminal for web, mobile and tablet from one PWA: one-click execution, 450+ indicators, multi-language. Lite White Label, Full White Label or Broker-in-a-Box." },
  { key: "invest", name: "Invest Trader", draw: drawInvestTrader, about: "Social trading with copy trading, PAMM and MAM: 3x client retention, 5x trading volume, 30%+ AUM growth potential." },
  { key: "ai", name: "AI Trader", draw: drawAiTrader, about: "AI-assisted market intelligence: technical indicators, momentum and sentiment as colour-coded bubbles, with execution in the same interface." },
  { key: "prop", name: "Prop Trading", draw: drawProp, about: "Challenge and evaluation engine, automated payout rules, funded-account oversight and real-time risk controls that flag rule breaches as they happen." },
  { key: "crm", name: "CRM & Back Office", draw: drawCrm, about: "Client lifecycle, lead management and sales funnels, automated KYC/AML (Sumsub, Shufti Pro), 25+ payment providers, real-time P&L reporting and client portals." },
  { key: "oms", name: "Order Management", draw: drawOms, about: "Multi-LP aggregation, smart order routing, custom markup and spread engine, A/B book management." },
  { key: "bridge", name: "Bridge & Connectivity", draw: drawBridge, about: "Ultra-low latency MT4 bridge and MT5 gateway, FIX API, price-feed aggregation and sub-millisecond execution." },
  { key: "plugins", name: "Plug-ins", draw: drawPlugins, about: "Social Trading, PAMM, IB/Affiliates Portal and a Risk Management Module to extend any platform." },
];

/** A product's screen texture, by key (for desk monitors). */
export function useProductScreen(key: string) {
  const product = PRODUCTS.find((p) => p.key === key)!;
  return useCanvas(1024, 600, (ctx, w, h) => product.draw(ctx, w, h), key).texture;
}

/**
 * A free-standing product totem: a landscape screen on a slim stand with a name plate.
 * Faces +z. E or a click tells what the product does. The AI Trader's bubbles breathe.
 */
export function ProductTotem({ product, position, rotationY }: { product: Product; position: [number, number, number]; rotationY: number }) {
  const f = finishes();
  const { ctx, texture } = useCanvas(1024, 600, (c, w, h) => product.draw(c, w, h, 0), product.key);
  const t = useRef(0);
  useFrame((_, delta) => {
    if (product.key !== "ai") return;
    const dx = playerState.position.x - position[0];
    const dz = playerState.position.z - position[2];
    if (dx * dx + dz * dz > 14 * 14) return;
    t.current += delta;
    if (Math.floor(t.current * 8) !== Math.floor((t.current - delta) * 8)) {
      product.draw(ctx, 1024, 600, t.current);
      texture.needsUpdate = true;
    }
  });
  const tell = () => {
    sfx.pop();
    useCityStore.getState().toast(product.about, `Reltrix · ${product.name}`);
  };
  const where = useMemo(() => new THREE.Vector3(position[0], 0, position[2]), [position]);
  useProximity({ id: `reltrix-${product.key}`, label: `About ${product.name}`, radius: 1.8, where, run: tell });
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.02, 0]} material={f.blackMetal}>
        <boxGeometry args={[0.8, 0.04, 0.5]} />
      </mesh>
      <mesh position={[0, 0.6, -0.05]} material={plain("#111827", 0.4)}>
        <boxGeometry args={[0.1, 1.2, 0.08]} />
      </mesh>
      <group position={[0, 1.62, 0]} rotation-x={-0.06}>
        <mesh position={[0, 0, -0.03]} material={plain("#0b0f19", 0.3)}>
          <boxGeometry args={[1.94, 1.16, 0.05]} />
        </mesh>
        <mesh
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            tell();
          }}
        >
          <planeGeometry args={[1.86, 1.09]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.6, 0.0]}>
          <boxGeometry args={[1.94, 0.025, 0.06]} />
          <meshStandardMaterial color={RX.cyan} emissive={RX.cyan} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      </group>
      <Text position={[0, 0.92, 0.02]} fontSize={0.09} color={RX.cyan} anchorX="center" anchorY="middle">
        {product.name.toUpperCase()}
      </Text>
      <Block position={[0, 0.8, 0]} size={[0.9, 1.6, 0.4]} />
    </group>
  );
}

/** The ecosystem wall (faces +z). */
export function EcosystemPanel({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const { texture } = useCanvas(1024, 760, drawEcosystem);
  return <Panel position={position} rotationY={rotationY} width={3.0} height={2.23} map={texture} frame="#0b0f19" />;
}

/** SAHMEE Group and its five entities (faces +z). */
export function GroupPanel({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const { texture } = useCanvas(1600, 520, drawGroup);
  return <Panel position={position} rotationY={rotationY} width={6.4} height={2.08} map={texture} frame="#0b1c33" />;
}

/** "Reltrix" in glowing cyan letters (faces +z). */
export function ReltrixNeon({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: RX.cyan, toneMapped: false }), []);
  useFrame(({ clock }) => {
    glow.color.setHSL(0.52, 0.75, 0.52 + Math.sin(clock.elapsedTime * 2) * 0.05);
  });
  return (
    <group position={position} rotation-y={rotationY}>
      <Text fontSize={0.62} material={glow} anchorX="center" anchorY="middle">
        Reltrix
      </Text>
      <Text position={[0, -0.5, 0]} fontSize={0.15} color="#1a103d" anchorX="center" anchorY="middle">
        Technology that powers trading at every scale
      </Text>
    </group>
  );
}
