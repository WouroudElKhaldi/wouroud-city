"use client";

import { Text } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Experience } from "@/content/schema";
import { useCityStore, type Seat } from "@/state/useCityStore";
import { playerState } from "@/world/env";
import { DEVELEB_ROOM } from "@/world/interiors";
import { sfx } from "@/world/sfx";
import {
  Batch,
  Block,
  ConferenceChair,
  DESK_TOP,
  plain,
  SeatedPerson,
  Sofa,
  sofaSeats,
  Table,
  TallPlant,
  Workstation,
  workSeat,
  ahead,
  DESK_REACH,
  Nameplate,
} from "./Furniture";
import { OnWall, Plaque } from "./InteriorScene";
import { finishes } from "./luxury";
import { emitBurst } from "./Particles";
import { makeWalkers, Pedestrians } from "./Pedestrians";
import { Seats } from "./StreetDetails";
import { canvasTexture } from "./TradingFloor";
import { useProximity } from "./useProximity";

/**
 * Develeb ("Developing Lebanon"), Lebanon's developer community, whose website Wouroud
 * designed (UI/UX) and helped build. Its room is a community hub in the website's own
 * design language: deep navy, emerald green and off-white, the pixel-cedar logo, green
 * event cards with contour lines and dot grids. Every wall is a section of the site:
 * the typing hero behind the stage, the stats, the events, the jobs board, partners,
 * testimonials, the newsletter and the founders, plus a wall of Wouroud's designs of the
 * site and her design desk. Audience rows face the stage, as at Develeb's workshops.
 */

const W = DEVELEB_ROOM.width;
const D = DEVELEB_ROOM.depth;
const H = DEVELEB_ROOM.height;

const NAVY = "#061b2e";
const NAVY_2 = "#0b2740";
const GREEN = "#10c38e";
const GREEN_DARK = "#0a8f68";
const MINT = "#d7f5ea";
const OFFWHITE = "#fafafa";
const INK = "#0b1b2b";
const GREY = "#64748b";
const FONT = `"Segoe UI", Helvetica, Arial, sans-serif`;
const font = (px: number, weight = "") => `${weight} ${Math.round(px)}px ${FONT}`;

const STAGE = { x: 7.5, front: -D / 2 + 3.8, height: 0.35 };

// ---------------------------------------------------------------------------
// Content (from develeb.org)
// ---------------------------------------------------------------------------

const EVENTS: [string, string, string][] = [
  ["Fireside Chat: Working At Meta", "Hadi Kotaich", "48 days ago"],
  ["The Open Source Mindset", "Omar Chouman", "95 days ago"],
  ["Ask Seniors Anything", "Ghadi Al Ghosh, Jawad Srour", "264 days ago"],
  ["The Art of Clean Code & Architecture", "Jawad Srour", "509 days ago"],
  ["Crash Course: Laravel", "Hassan Hammoud", "570 days ago"],
  ["Cracking the Coding Interview", "Ahmad Houmani, Jawad Srour", "901 days ago"],
];

const JOBS: [string, string, string, string, string, string][] = [
  ["CyberSecurity Engineer Internship", "Cybersecurity", "Junior", "Beirut, Lebanon", "ICC Group", "Internship · Hybrid"],
  ["Ingénieur Support Applicatif", "Software", "Junior", "Beirut, Lebanon", "acteos", "Full-time · Onsite"],
  ["Senior AI Engineer - HYPR", "Software", "Senior", "Beirut, Lebanon", "Aspire Software", "Full-time · Onsite"],
  ["Quality Assurance Specialist", "Software", "Junior", "Beirut, Lebanon", "i manage", "Full-time · Onsite"],
  ["AI Engineer Internship", "AI/ML", "Junior", "Remote", "NV Group", "Internship · Remote"],
  ["DevOps Engineer", "DevOps", "Junior", "Tripoli, Lebanon", "DYNAMIX Agency", "Full-time · Onsite"],
  ["Product Manager", "Software", "Senior", "Lebanon", "SupportRoom", "Full-time · Onsite"],
];

const TESTIMONIALS: [string, string, string][] = [
  [
    "I have to commend the vigilance, consistency, and cleanliness of the community, messages, and organization. Lebanon's tech future is more promising than ever.",
    "Christophe El-Khoury",
    "Fractional CTO, Technology Advisor",
  ],
  [
    "At Develeb, we were able to bridge the gap between job market, graduates and experienced software engineers, with undergrads and interested candidates.",
    "Lara Wehbe",
    "CEO @ Fakker.AI",
  ],
  [
    "Communities like Develeb are much needed especially in our fast moving industry. It's always a pleasure to connect with other engineers and help junior developers succeed.",
    "Sami Shameseldeen",
    "Software Engineer @ Murex",
  ],
  [
    "It's inspiring to see Lebanese people sharing their knowledge and helping beginners navigate the job market.",
    "Zaynab Mama",
    "Full Stack Developer",
  ],
  [
    "Develeb is a great space for both beginners and senior engineers to learn, share, and grow.",
    "Hamza Jadid",
    "Senior Software Engineer @ Proximie",
  ],
  [
    "I especially appreciated the tips shared during events: insights you usually can't find anywhere else except from those with real industry experience.",
    "Rayan Sarieddine",
    "Software Developer",
  ],
];

const PARTNERS = ["Purpl", "JetBrains", "IEEE Lebanon", "GDG Coast Lebanon", "AWS User Group Beirut", "Supportful", "Tech Circle"];

// ---------------------------------------------------------------------------
// Drawing helpers (the site's look on canvases)
// ---------------------------------------------------------------------------

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number) {
  let row = "";
  for (const word of text.split(" ")) {
    const next = row ? `${row} ${word}` : word;
    if (ctx.measureText(next).width > max && row) {
      ctx.fillText(row, x, y);
      y += line;
      row = word;
    } else row = next;
  }
  if (row) ctx.fillText(row, x, y);
  return y + line;
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lineWidth = 2) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/** The pixel cedar from Develeb's logo: rows of squares widening toward the base. */
const CEDAR_ROWS = [1, 3, 3, 5, 5, 7, 7, 9, 9, 11, 1, 1];
function drawCedar(ctx: CanvasRenderingContext2D, cx: number, top: number, cell: number, color = GREEN) {
  CEDAR_ROWS.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = r >= 10 ? GREEN_DARK : (i + r) % 3 === 0 ? "#34d3a2" : color;
      ctx.fillRect(cx + (i - n / 2) * cell, top + r * cell, cell * 0.8, cell * 0.8);
    }
  });
}

/** The site's dark hero background: navy with soft green glows. */
function heroBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);
  for (const [x, y, r] of [
    [0.85, 0.35, 0.45],
    [0.12, 0.85, 0.4],
    [0.55, 1.05, 0.35],
  ]) {
    const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
    g.addColorStop(0, "rgba(16,195,142,0.28)");
    g.addColorStop(1, "rgba(16,195,142,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
}

/** Contour lines in a card's corner and dot grids, as on the site's event cards. */
function contours(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(x + w * 1.02, y + h * 0.08, w * (0.12 + i * 0.07), h * (0.2 + i * 0.09), 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
function dots(ctx: CanvasRenderingContext2D, x: number, y: number, cols: number, rows: number, gap: number, color = "rgba(255,255,255,0.8)") {
  ctx.fillStyle = color;
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      ctx.beginPath();
      ctx.arc(x + c * gap, y + r * gap, gap * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
}

/** A canvas texture drawn once; a new `key` draws it again. */
function useCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, key: string | number = 0) {
  const made = useMemo(() => {
    const { ctx, texture } = canvasTexture(w, h);
    draw(ctx, w, h);
    texture.needsUpdate = true;
    return { ctx, texture };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, key]);
  useEffect(() => () => made.texture.dispose(), [made]);
  return made;
}

function drawEventCard(ctx: CanvasRenderingContext2D, w: number, h: number, [title, speaker, when]: [string, string, string]) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);
  box(ctx, 0, 0, w, h, 10, GREEN);
  contours(ctx, 0, 0, w, h);
  dots(ctx, 36, 36, 3, 3, 16);
  ctx.fillStyle = INK;
  ctx.font = font(h * 0.07);
  let y = wrap(ctx, title, 30, h * 0.24, w * 0.82, h * 0.085);
  ctx.font = font(h * 0.04);
  ctx.fillStyle = "#08392b";
  for (const [icon, text] of [
    ["▢", when],
    ["◯", speaker],
    ["⌖", "Online"],
  ]) {
    y += h * 0.02;
    ctx.fillText(`${icon}  ${text}`, 30, y);
    y += h * 0.075;
  }
  dots(ctx, 36, h - 70, 6, 3, 13);
  box(ctx, w - 170, h - 96, 140, 62, 8, NAVY);
  ctx.fillStyle = "#fff";
  ctx.font = font(26, "bold");
  ctx.fillText("View →", w - 145, h - 55);
}

function drawJobsTable(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = OFFWHITE;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = INK;
  ctx.font = font(h * 0.07, "bold");
  ctx.fillText("Our Latest Jobs", w * 0.03, h * 0.11);
  ctx.fillRect(w * 0.03 + 4, h * 0.145, 54, 8);
  const top = h * 0.2;
  box(ctx, w * 0.02, top, w * 0.96, h * 0.74, 14, "#ffffff", "#e5e7eb");
  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(w * 0.02 + 2, top + 2, w * 0.96 - 4, h * 0.08);
  const cols = [0.04, 0.3, 0.46, 0.57, 0.74, 0.88];
  ctx.fillStyle = "#374151";
  ctx.font = font(h * 0.028, "bold");
  ["Job Title", "Job Category", "Job Level", "Location", "Company", "Date Posted"].forEach((c, i) => ctx.fillText(c, w * cols[i], top + h * 0.052));
  const ago = ["17 hours ago", "1 day ago", "1 day ago", "1 day ago", "1 day ago"];
  JOBS.slice(0, 5).forEach((j, r) => {
    const y = top + h * 0.08 + r * h * 0.096;
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(w * 0.02, y);
    ctx.lineTo(w * 0.98, y);
    ctx.stroke();
    ctx.font = font(h * 0.03);
    ctx.fillStyle = INK;
    ctx.fillText(j[0], w * cols[0], y + h * 0.06);
    ctx.font = font(h * 0.024);
    const pill = ctx.measureText(j[1]).width + 24;
    box(ctx, w * cols[1], y + h * 0.027, pill, h * 0.045, 20, "#eef2f2");
    ctx.fillStyle = "#334155";
    ctx.fillText(j[1], w * cols[1] + 12, y + h * 0.057);
    ctx.font = font(h * 0.03);
    ctx.fillStyle = INK;
    ctx.fillText(j[2], w * cols[2], y + h * 0.06);
    ctx.fillText(j[3], w * cols[3], y + h * 0.06);
    ctx.fillText(j[4], w * cols[4], y + h * 0.06);
    ctx.fillText(ago[r], w * cols[5], y + h * 0.06);
  });
  box(ctx, w * 0.42, h * 0.84, w * 0.16, h * 0.075, 10, GREEN);
  ctx.fillStyle = INK;
  ctx.font = font(h * 0.032, "bold");
  ctx.fillText("View All Jobs →", w * 0.44, h * 0.89);
}

function drawJobCard(ctx: CanvasRenderingContext2D, w: number, h: number, index: number) {
  const j = JOBS[index % JOBS.length];
  ctx.fillStyle = OFFWHITE;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = INK;
  ctx.font = font(h * 0.07, "bold");
  ctx.fillText("Find Your Next Job", 34, h * 0.12);
  ctx.fillRect(38, h * 0.155, 46, 7);
  box(ctx, 26, h * 0.22, w - 52, h * 0.5, 14, "#ffffff", "#e5e7eb");
  box(ctx, 50, h * 0.27, 96, 96, 14, MINT);
  ctx.fillStyle = GREEN_DARK;
  ctx.font = font(52, "bold");
  ctx.fillText(j[4][0].toUpperCase(), 80, h * 0.27 + 66);
  ctx.fillStyle = INK;
  ctx.font = font(h * 0.05, "bold");
  const y = wrap(ctx, j[0], 170, h * 0.31, w - 210, h * 0.06);
  ctx.font = font(h * 0.04);
  ctx.fillStyle = "#374151";
  ctx.fillText(j[4], 170, y);
  ctx.fillText(j[5], 50, h * 0.6);
  ctx.fillText(`⌖ ${j[3]}`, 50, h * 0.66);
  box(ctx, w / 2 - 140, h * 0.78, 280, h * 0.09, 12, GREEN);
  ctx.fillStyle = INK;
  ctx.font = font(h * 0.04, "bold");
  ctx.textAlign = "center";
  ctx.fillText("Next job →", w / 2, h * 0.837);
  ctx.textAlign = "left";
  ctx.fillStyle = GREY;
  ctx.font = font(h * 0.03);
  ctx.fillText(`${(index % JOBS.length) + 1} of ${JOBS.length} · click or press E`, 34, h * 0.95);
}

function drawTestimonial(ctx: CanvasRenderingContext2D, w: number, h: number, [quote, name, title]: [string, string, string]) {
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, w, h);
  box(ctx, 2, 2, w - 4, h - 4, 14, "#ffffff");
  ctx.fillStyle = GREEN;
  ctx.font = font(30);
  ctx.fillText("★★★★★", 28, 52);
  ctx.strokeStyle = MINT;
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 70, 24, 18);
  ctx.fillStyle = INK;
  ctx.font = font(h * 0.055);
  wrap(ctx, `"${quote}"`, 28, 130, w - 56, h * 0.075);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(28, h - 100);
  ctx.lineTo(w - 28, h - 100);
  ctx.stroke();
  ctx.fillStyle = GREEN_DARK;
  ctx.beginPath();
  ctx.arc(60, h - 52, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = font(24, "bold");
  ctx.textAlign = "center";
  ctx.fillText(
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2),
    60,
    h - 43,
  );
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = font(h * 0.05, "bold");
  ctx.fillText(name, 104, h - 58);
  ctx.fillStyle = GREY;
  ctx.font = font(h * 0.04);
  ctx.fillText(title, 104, h - 26);
}

function drawNewsletter(ctx: CanvasRenderingContext2D, w: number, h: number) {
  heroBackground(ctx, w, h);
  box(ctx, 40, 40, 58, 58, 10, "rgba(16,195,142,0.18)");
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 3;
  ctx.strokeRect(54, 58, 30, 22);
  ctx.fillStyle = GREEN;
  ctx.font = font(26, "bold");
  ctx.fillText("Newsletter", 114, 78);
  ctx.fillStyle = "#fff";
  ctx.font = font(78, "bold");
  ctx.fillText("Stay in the Loop", 40, 190);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = font(28);
  wrap(ctx, "Get exclusive updates on job opportunities, community events, and industry insights delivered straight to your inbox.", 40, 250, w * 0.5, 40);
  ["Weekly job opportunities", "Exclusive event invitations", "Industry insights & tips"].forEach((t, i) => {
    ctx.fillStyle = GREEN;
    ctx.beginPath();
    ctx.arc(52, 392 + i * 46, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = font(26);
    ctx.fillText(t, 74, 401 + i * 46);
  });
  const fx = w * 0.6;
  box(ctx, fx, 170, w * 0.36, 300, 16, "rgba(255,255,255,0.03)", "rgba(16,195,142,0.25)");
  box(ctx, fx + 30, 200, w * 0.36 - 60, 70, 10, "rgba(255,255,255,0.06)", "rgba(255,255,255,0.15)");
  ctx.fillStyle = "#94a3b8";
  ctx.font = font(26);
  ctx.fillText("Enter your email", fx + 50, 245);
  box(ctx, fx + 30, 296, w * 0.36 - 60, 74, 10, GREEN);
  ctx.fillStyle = INK;
  ctx.font = font(28, "bold");
  ctx.textAlign = "center";
  ctx.fillText("Sign up", fx + w * 0.18, 343);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = font(18);
  ctx.fillText("We respect your privacy. Unsubscribe at any time.", fx + w * 0.18, 420);
  ctx.textAlign = "left";
}

function drawFounder(ctx: CanvasRenderingContext2D, w: number, h: number, name: string, blurb: string) {
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, w, h);
  box(ctx, 2, 2, w - 4, h - 4, 16, "#ffffff");
  ctx.fillStyle = MINT;
  ctx.beginPath();
  ctx.arc(w / 2, 150, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = GREEN_DARK;
  ctx.font = font(70, "bold");
  ctx.textAlign = "center";
  ctx.fillText(
    name
      .split(" ")
      .map((p) => p[0])
      .join(""),
    w / 2,
    175,
  );
  ctx.fillStyle = INK;
  ctx.font = font(40, "bold");
  ctx.fillText(name, w / 2, 310);
  ctx.fillStyle = GREEN_DARK;
  ctx.font = font(28, "bold");
  ctx.fillText("Co-Founder", w / 2, 352);
  ctx.fillStyle = GREY;
  ctx.font = font(25);
  wrap(ctx, blurb, w / 2, 410, w - 70, 36);
  ctx.textAlign = "left";
}

function drawPartners(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);
  const styles = ["#c026d3", "#ffffff", "#e2e8f0", "#93c5fd", "#fbbf24", "#cbd5e1", "#94a3b8"];
  let x = 40;
  for (let pass = 0; pass < 2; pass++)
    PARTNERS.forEach((p, i) => {
      ctx.fillStyle = styles[i];
      ctx.font = font(i === 0 ? 70 : 54, i === 0 ? "bold" : "bold");
      ctx.fillText(i === 1 ? "JETBRAINS" : i === 2 ? "◈ IEEE Lebanon" : p, x, h * 0.66);
      x += ctx.measureText(p).width + 140;
    });
}

/** The Develeb home page as Wouroud designed it, in miniature. */
function drawMockHome(ctx: CanvasRenderingContext2D, w: number, h: number) {
  heroBackground(ctx, w, h * 0.58);
  drawCedar(ctx, 34, 14, 3);
  ctx.fillStyle = "#fff";
  ctx.font = font(20, "bold");
  ctx.fillText("Develeb", 58, 36);
  ctx.font = font(15);
  ctx.fillText("Jobs   Resources   Events   About", w - 380, 34);
  box(ctx, w - 132, 16, 54, 28, 6, undefined, GREEN);
  box(ctx, w - 70, 16, 50, 28, 6, GREEN);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = font(56, "bold");
  ctx.fillText("Lebanon's Tech", w / 2, h * 0.24);
  ctx.fillText("Community|", w / 2, h * 0.34);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = font(16);
  ctx.fillText("Join Lebanon's largest tech community! Gain access to the latest jobs and events.", w / 2, h * 0.41);
  box(ctx, w / 2 - 150, h * 0.45, 140, 38, 6, GREEN);
  box(ctx, w / 2 + 10, h * 0.45, 120, 38, 6, undefined, "#ffffff");
  ctx.fillStyle = INK;
  ctx.font = font(15, "bold");
  ctx.fillText("Become a member →", w / 2 - 80, h * 0.45 + 25);
  ctx.fillStyle = "#fff";
  ctx.fillText("Learn More", w / 2 + 70, h * 0.45 + 25);
  ctx.fillStyle = OFFWHITE;
  ctx.fillRect(0, h * 0.58, w, h * 0.42);
  ctx.fillStyle = INK;
  ctx.font = font(30, "bold");
  ctx.fillText("Developing Lebanon's Tech Talent", w / 2, h * 0.67);
  ctx.textAlign = "left";
  [
    ["4000+", "Members Joined"],
    ["500+", "Jobs Posted"],
    ["30+", "Events Hosted"],
  ].forEach(([n, t], i) => {
    const x = w * 0.14 + i * w * 0.25;
    box(ctx, x, h * 0.72, w * 0.22, h * 0.22, 10, "#ffffff", "#e5e7eb");
    box(ctx, x + w * 0.11 - 14, h * 0.74, 28, 28, 6, MINT);
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = font(30, "bold");
    ctx.fillText(n, x + w * 0.11, h * 0.86);
    ctx.font = font(14, "bold");
    ctx.fillText(t, x + w * 0.11, h * 0.91);
    ctx.textAlign = "left";
  });
}

function drawMockJobs(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = OFFWHITE;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, 50);
  drawCedar(ctx, 34, 8, 3);
  ctx.fillStyle = "#fff";
  ctx.font = font(20, "bold");
  ctx.fillText("Develeb", 58, 32);
  ctx.fillStyle = INK;
  ctx.font = font(30, "bold");
  ctx.fillText("Find Your Next Job", 30, 100);
  ctx.fillRect(32, 112, 36, 5);
  box(ctx, 26, 140, w * 0.24, h - 170, 10, "#ffffff", "#e5e7eb");
  ["Search", "Type", "Job Level", "Job Category"].forEach((t, i) => {
    ctx.fillStyle = INK;
    ctx.font = font(15);
    ctx.fillText(t, 42, 172 + i * 78);
    box(ctx, 42, 182 + i * 78, w * 0.24 - 34, 34, 6, "#ffffff", "#d1d5db");
  });
  box(ctx, 70, h - 76, 110, 40, 8, GREEN);
  JOBS.slice(0, 4).forEach((j, i) => {
    const y = 140 + i * ((h - 170) / 4);
    box(ctx, w * 0.29, y, w * 0.68, (h - 170) / 4 - 12, 10, "#ffffff", "#e5e7eb");
    box(ctx, w * 0.31, y + 22, 52, 52, 8, MINT);
    ctx.fillStyle = INK;
    ctx.font = font(20);
    ctx.fillText(j[0], w * 0.31 + 70, y + 40);
    ctx.fillStyle = GREY;
    ctx.font = font(15);
    ctx.fillText(`${j[4]}   ·   ${j[5]}   ·   ${j[3]}`, w * 0.31 + 70, y + 70);
  });
}

function drawMockEvents(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.font = font(30, "bold");
  ctx.fillText("Our Latest Events", 30, 60);
  ctx.fillRect(32, 76, 36, 5);
  EVENTS.slice(0, 3).forEach((e, i) => {
    const cw = (w - 120) / 3;
    const x = 30 + i * (cw + 30);
    ctx.save();
    ctx.translate(x, 110);
    drawEventCardMini(ctx, cw, h - 190, e);
    ctx.restore();
  });
  [0, 1, 2, 3, 4, 5].forEach((i) => {
    ctx.fillStyle = i === 0 ? GREEN : "#1f6f5a";
    ctx.fillRect(w / 2 - 70 + i * 22, h - 50, i === 0 ? 30 : 10, 8);
  });
}
function drawEventCardMini(ctx: CanvasRenderingContext2D, w: number, h: number, [title, speaker, when]: [string, string, string]) {
  box(ctx, 0, 0, w, h, 6, GREEN);
  contours(ctx, 0, 0, w, h);
  dots(ctx, 18, 18, 3, 3, 9);
  ctx.fillStyle = INK;
  ctx.font = font(22);
  let y = wrap(ctx, title, 16, 70, w - 30, 28);
  ctx.font = font(14);
  for (const t of [when, speaker, "Online"]) {
    y += 6;
    ctx.fillText(t, 16, y);
    y += 22;
  }
  box(ctx, w - 82, h - 50, 70, 36, 5, NAVY);
  ctx.fillStyle = "#fff";
  ctx.font = font(14, "bold");
  ctx.fillText("View →", w - 70, h - 27);
}

/** The design tool on Wouroud's second monitor: frames of the site on a canvas, layers and properties. */
function drawFigma(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#2c2c2c";
  ctx.fillRect(0, 0, w, 26);
  ctx.fillRect(0, 26, 92, h);
  ctx.fillRect(w - 100, 26, 100, h);
  ctx.fillStyle = "#e5e5e5";
  ctx.font = font(12);
  ["Home", "  Hero", "  Stats", "  Events", "Jobs", "Events", "About"].forEach((t, i) => ctx.fillText(t, 8, 48 + i * 18));
  ctx.fillText("Fill  #10C38E", w - 94, 50);
  ctx.fillText("Fill  #061B2E", w - 94, 70);
  ctx.fillText("Radius  8", w - 94, 90);
  ctx.fillStyle = "#383838";
  ctx.fillRect(92, 26, w - 192, h - 26);
  const frames: [number, number][] = [
    [110, 50],
    [230, 50],
    [110, 180],
    [230, 180],
  ];
  frames.forEach(([x, y], i) => {
    ctx.fillStyle = i % 2 ? OFFWHITE : NAVY;
    ctx.fillRect(x, y, 100, 110);
    ctx.fillStyle = GREEN;
    ctx.fillRect(x + 10, y + 70, 40, 12);
    ctx.fillStyle = i % 2 ? INK : "#fff";
    ctx.fillRect(x + 10, y + 30, 70, 8);
    ctx.fillRect(x + 10, y + 44, 50, 8);
  });
  ctx.strokeStyle = "#18a0fb";
  ctx.lineWidth = 2;
  ctx.strokeRect(108, 48, 104, 114);
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

let concreteTexture: THREE.CanvasTexture | null = null;
function concrete() {
  if (concreteTexture) return concreteTexture;
  const size = 512;
  const { ctx, texture } = canvasTexture(size, size);
  ctx.fillStyle = "#c9ccce";
  ctx.fillRect(0, 0, size, size);
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // Soft clouds, then fine aggregate speckle
  for (let i = 0; i < 160; i++) {
    const v = r() < 0.5 ? 255 : 90;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},0.025)`;
    ctx.beginPath();
    ctx.arc(r() * size, r() * size, 30 + r() * 90, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 5000; i++) {
    const v = r() < 0.5 ? 255 : 70;
    ctx.fillStyle = `rgba(${v},${v},${v},0.12)`;
    ctx.fillRect(r() * size, r() * size, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  ctx.strokeStyle = "rgba(60,64,70,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(W / 4, D / 4);
  texture.needsUpdate = true;
  return (concreteTexture = texture);
}

/** The hub itself: polished concrete, navy wainscoting with a green line, white walls, clerestory windows. */
function CommunityShell() {
  const f = finishes();
  const floor = useMemo(() => concrete(), []);
  const walls = [
    { side: "back" as const, pos: [0, 0, -D / 2] as const, rot: 0, len: W },
    { side: "front" as const, pos: [0, 0, D / 2] as const, rot: Math.PI, len: W },
    { side: "left" as const, pos: [-W / 2, 0, 0] as const, rot: Math.PI / 2, len: D },
    { side: "right" as const, pos: [W / 2, 0, 0] as const, rot: -Math.PI / 2, len: D },
  ];
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 1.4, toneMapped: false }), []);
  const ledBar = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#f1fff9", emissiveIntensity: 2, toneMapped: false }), []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2 + 1, 0.5, D / 2 + 1]} position={[0, -0.5, 0]} />
        <CuboidCollider args={[W / 2 + 1, H, 0.5]} position={[0, H, -D / 2 - 0.5]} />
        <CuboidCollider args={[W / 2 + 1, H, 0.5]} position={[0, H, D / 2 + 0.5]} />
        <CuboidCollider args={[0.5, H, D / 2 + 1]} position={[-W / 2 - 0.5, H, 0]} />
        <CuboidCollider args={[0.5, H, D / 2 + 1]} position={[W / 2 + 0.5, H, 0]} />
      </RigidBody>
      <Batch>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[W, D]} />
          <meshStandardMaterial map={floor} roughness={0.32} metalness={0.05} envMapIntensity={1.2} />
        </mesh>
        {walls.map(({ side, pos, rot, len }) => (
          <group key={side} position={[pos[0], pos[1], pos[2]]} rotation-y={rot}>
            <mesh position={[0, H / 2, 0]} material={plain(OFFWHITE, 0.85)} receiveShadow>
              <planeGeometry args={[len, H]} />
            </mesh>
            <mesh position={[0, 0.6, 0.012]} material={plain(NAVY, 0.6)}>
              <planeGeometry args={[len, 1.2]} />
            </mesh>
            <mesh position={[0, 0.05, 0.016]} material={plain("#020c16", 0.5)}>
              <planeGeometry args={[len, 0.1]} />
            </mesh>
            <mesh position={[0, H - 0.2, 0.012]} material={plain(NAVY, 0.6)}>
              <planeGeometry args={[len, 0.4]} />
            </mesh>
          </group>
        ))}
        {/* Dark ceiling with steel joists */}
        <mesh rotation-x={Math.PI / 2} position={[0, H, 0]} material={plain("#0d2236", 0.9)}>
          <planeGeometry args={[W, D]} />
        </mesh>
        {Array.from({ length: Math.floor(W / 3) }, (_, i) => -W / 2 + 1.5 + i * 3).map((x) => (
          <mesh key={x} position={[x, H - 0.18, 0]} material={f.blackMetal}>
            <boxGeometry args={[0.14, 0.36, D]} />
          </mesh>
        ))}
        {/* Steel columns along the side walls */}
        {[-11.6, 0, 11.6].flatMap((z) =>
          [-1, 1].map((s) => (
            <mesh key={`${z}${s}`} position={[s * (W / 2 - 0.2), H / 2, z]} material={plain(NAVY_2, 0.5)} castShadow>
              <boxGeometry args={[0.4, H, 0.4]} />
            </mesh>
          )),
        )}
        {/* Clerestory windows high on both side walls, black steel grid */}
        {[-1, 1].flatMap((s) =>
          [-6.5, 4.5].map((z) => (
            <group key={`${s}${z}`} position={[s * (W / 2 - 0.02), H - 0.72, z]} rotation-y={-s * (Math.PI / 2)}>
              <mesh>
                <planeGeometry args={[8, 0.8]} />
                <meshStandardMaterial color="#a9d6f5" emissive="#d6efff" emissiveIntensity={0.9} />
              </mesh>
              {Array.from({ length: 9 }, (_, k) => (
                <mesh key={k} position={[-4 + k, 0, 0.02]} material={f.blackMetal}>
                  <boxGeometry args={[0.05, 0.85, 0.04]} />
                </mesh>
              ))}
              {[-0.4, 0, 0.4].map((y) => (
                <mesh key={y} position={[0, y, 0.02]} material={f.blackMetal}>
                  <boxGeometry args={[8.05, 0.05, 0.04]} />
                </mesh>
              ))}
            </group>
          )),
        )}
      </Batch>
      {/* The green line along the wainscoting, glowing faintly */}
      {walls.map(({ side, pos, rot, len }) => (
        <mesh key={side} position={[pos[0] + (side === "left" ? 0.02 : side === "right" ? -0.02 : 0), 1.21, pos[2] + (side === "back" ? 0.02 : side === "front" ? -0.02 : 0)]} rotation-y={rot} material={glow}>
          <planeGeometry args={[len, 0.035]} />
        </mesh>
      ))}
      {/* Linear LED pendants */}
      {[-6, 0, 6].flatMap((z) =>
        [-8, 0, 8].map((x) => (
          <group key={`${x}${z}`} position={[x, H - 1.1, z]}>
            <mesh material={f.blackMetal}>
              <boxGeometry args={[4, 0.07, 0.12]} />
            </mesh>
            <mesh position={[0, -0.04, 0]} material={ledBar}>
              <boxGeometry args={[3.9, 0.012, 0.08]} />
            </mesh>
            {[-1.8, 1.8].map((dx) => (
              <mesh key={dx} position={[dx, 0.55, 0]} material={f.blackMetal}>
                <cylinderGeometry args={[0.004, 0.004, 1.1, 4]} />
              </mesh>
            ))}
          </group>
        )),
      )}
      {[
        [0, -4],
        [-10, -4],
        [10, -4],
        [-10, 6],
        [10, 6],
        [0, 8],
      ].map(([x, z]) => (
        <pointLight key={`${x}${z}`} position={[x, H - 1.4, z]} intensity={11} distance={13} decay={2} color="#f4fffb" />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Stage
// ---------------------------------------------------------------------------

/** The site's hero, typing its headline, as the stage backdrop; the buttons work. */
function HeroWall() {
  const words = useMemo(() => ["Community", "Talent", "Future"], []);
  const state = useMemo(() => {
    const { ctx, texture } = canvasTexture(1600, 520);
    return { ctx, texture, word: 0, chars: words[0].length, deleting: false, wait: 1.5, t: 0, cursor: true, blink: 0 };
  }, [words]);
  const draw = () => {
    const { ctx, texture } = state;
    const w = 1600;
    const h = 520;
    heroBackground(ctx, w, h);
    drawCedar(ctx, 70, 26, 6);
    ctx.fillStyle = "#fff";
    ctx.font = font(40, "bold");
    ctx.fillText("Develeb", 115, 62);
    ctx.font = font(26);
    ctx.fillText("Jobs     Resources     Events     About", w - 720, 60);
    box(ctx, w - 230, 30, 100, 46, 8, undefined, GREEN, 3);
    box(ctx, w - 115, 30, 90, 46, 8, GREEN);
    ctx.fillStyle = GREEN;
    ctx.font = font(24, "bold");
    ctx.fillText("Log In", w - 214, 62);
    ctx.fillStyle = INK;
    ctx.fillText("Join", w - 92, 62);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = font(104, "bold");
    ctx.fillText("Lebanon's Tech", w / 2, 210);
    const typed = words[state.word].slice(0, state.chars);
    ctx.fillText(`${typed}${state.cursor ? "|" : " "}`, w / 2, 318);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = font(30);
    ctx.fillText("Join Lebanon's largest tech community! Gain access to the latest job", w / 2, 378);
    ctx.fillText("opportunities, exclusive events, and a network of like-minded developers.", w / 2, 416);
    box(ctx, w / 2 - 250, 446, 270, 58, 8, GREEN);
    box(ctx, w / 2 + 40, 446, 190, 58, 8, undefined, "#ffffff", 3);
    ctx.fillStyle = INK;
    ctx.font = font(28, "bold");
    ctx.fillText("Become a member →", w / 2 - 115, 485);
    ctx.fillStyle = "#fff";
    ctx.fillText("Learn More", w / 2 + 135, 485);
    ctx.textAlign = "left";
    texture.needsUpdate = true;
  };
  useEffect(() => {
    draw();
    return () => state.texture.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  useFrame((_, delta) => {
    const s = state;
    s.blink += delta;
    let changed = false;
    if (s.blink > 0.5) {
      s.blink = 0;
      s.cursor = !s.cursor;
      changed = true;
    }
    s.t += delta;
    if (s.wait > 0) s.wait -= delta;
    else if (s.t > (s.deleting ? 0.05 : 0.11)) {
      s.t = 0;
      changed = true;
      if (!s.deleting) {
        if (s.chars < words[s.word].length) s.chars++;
        else {
          s.deleting = true;
          s.wait = 1.6;
        }
      } else if (s.chars > 0) s.chars--;
      else {
        s.deleting = false;
        s.word = (s.word + 1) % words.length;
      }
    }
    if (changed) draw();
  });
  const SW = 12.4;
  const SH = SW * (520 / 1600);
  const y = STAGE.height + 0.75 + SH / 2;
  // Button hit areas, in the screen's own space (meters from its center)
  const px = (x: number) => (x / 1600 - 0.5) * SW;
  const py = (yy: number) => (0.5 - yy / 520) * SH;
  return (
    <OnWall side="back">
      <group position={[0, y, -D / 2 + 0.08]}>
        <mesh position={[0, 0, -0.04]} material={finishes().blackMetal}>
          <boxGeometry args={[SW + 0.24, SH + 0.24, 0.06]} />
        </mesh>
        <mesh>
          <planeGeometry args={[SW, SH]} />
          <meshBasicMaterial map={state.texture} toneMapped={false} />
        </mesh>
        <mesh
          position={[px(800 - 115), py(475), 0.02]}
          visible={false}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            sfx.sparkle();
            useCityStore.getState().toast("4000+ members joined in the past year, and it's all free 💚", "Welcome to Develeb!");
          }}
        >
          <planeGeometry args={[(270 / 1600) * SW, (58 / 520) * SH]} />
        </mesh>
        <mesh
          position={[px(800 + 135), py(475), 0.02]}
          visible={false}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            useCityStore
              .getState()
              .toast("Short for Developing Lebanon: a developer-led community upskilling Lebanon's talent and fighting brain drain.", "About Develeb");
          }}
        >
          <planeGeometry args={[(190 / 1600) * SW, (58 / 520) * SH]} />
        </mesh>
      </group>
    </OnWall>
  );
}

/** The stage: a low platform with a glowing edge, steps, a lectern and a panel of armchairs. */
function Stage() {
  const f = finishes();
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 1.6, toneMapped: false }), []);
  const depth = STAGE.front + D / 2;
  const cz = -D / 2 + depth / 2;
  return (
    <group>
      <Batch>
        <mesh position={[0, STAGE.height / 2, cz]} material={plain("#0e2a42", 0.5)} castShadow receiveShadow>
          <boxGeometry args={[STAGE.x * 2, STAGE.height, depth]} />
        </mesh>
        <mesh position={[0, STAGE.height + 0.003, cz]} rotation-x={-Math.PI / 2} material={plain("#163a57", 0.35)}>
          <planeGeometry args={[STAGE.x * 2 - 0.1, depth - 0.1]} />
        </mesh>
        {/* Steps up on both sides */}
        {[-1, 1].flatMap((s) =>
          [1, 2].map((k) => (
            <mesh key={`${s}${k}`} position={[s * (STAGE.x - 0.9), (STAGE.height * k) / 3 / 2, STAGE.front + 0.25 * (3 - k)]} material={plain("#0e2a42", 0.5)}>
              <boxGeometry args={[1.6, (STAGE.height * k) / 3, 0.25 * (3 - k) * 2]} />
            </mesh>
          )),
        )}
        {/* Lectern with the cedar */}
        <group position={[-5.2, STAGE.height, STAGE.front - 0.9]}>
          <mesh position={[0, 0.55, 0]} material={plain(NAVY, 0.4)} castShadow>
            <boxGeometry args={[0.6, 1.1, 0.45]} />
          </mesh>
          <mesh position={[0, 1.12, -0.03]} rotation-x={0.3} material={plain(NAVY_2, 0.4)}>
            <boxGeometry args={[0.66, 0.04, 0.5]} />
          </mesh>
          <mesh position={[0, 0.0, 0]} material={f.blackMetal}>
            <boxGeometry args={[0.7, 0.04, 0.55]} />
          </mesh>
          <mesh position={[0.18, 1.32, -0.12]} rotation-x={-0.6} material={f.blackMetal}>
            <cylinderGeometry args={[0.006, 0.006, 0.4, 4]} />
          </mesh>
        </group>
        <mesh position={[0.6, STAGE.height + 0.3, STAGE.front - 1.6]} material={plain(OFFWHITE, 0.4)}>
          <cylinderGeometry args={[0.25, 0.25, 0.03, 24]} />
        </mesh>
        <mesh position={[0.6, STAGE.height + 0.15, STAGE.front - 1.6]} material={f.blackMetal}>
          <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
        </mesh>
      </Batch>
      {/* The lectern's pixel cedar plate */}
      <CedarPlate position={[-5.2, STAGE.height + 0.62, STAGE.front - 0.9 + 0.231]} size={0.42} />
      <mesh position={[0, STAGE.height + 0.01, STAGE.front + 0.005]} material={edge}>
        <boxGeometry args={[STAGE.x * 2, 0.025, 0.02]} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[STAGE.x, STAGE.height / 2, depth / 2]} position={[0, STAGE.height / 2, cz]} />
        <CuboidCollider args={[0.3, 0.55, 0.23]} position={[-5.2, STAGE.height + 0.55, STAGE.front - 0.9]} />
        {[-1, 1].flatMap((s) =>
          [1, 2].map((k) => (
            <CuboidCollider
              key={`${s}${k}`}
              args={[0.8, (STAGE.height * k) / 3 / 2, 0.25 * (3 - k)]}
              position={[s * (STAGE.x - 0.9), (STAGE.height * k) / 3 / 2, STAGE.front + 0.25 * (3 - k)]}
            />
          )),
        )}
      </RigidBody>
      {/* Stage lights hanging from the joists */}
      {[-4, 0, 4].map((x) => (
        <group key={x} position={[x, H - 0.5, STAGE.front + 1.5]} rotation-x={-0.7}>
          <mesh material={f.blackMetal}>
            <cylinderGeometry args={[0.12, 0.16, 0.36, 16]} />
          </mesh>
          <mesh position={[0, -0.181, 0]} rotation-x={Math.PI / 2}>
            <circleGeometry args={[0.14, 20]} />
            <meshStandardMaterial color="#fffbe8" emissive="#fff5d6" emissiveIntensity={2.5} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, H - 1.2, STAGE.front - 0.5]} intensity={14} distance={10} decay={2} color="#fff6e4" />
    </group>
  );
}

/** The pixel cedar as a small glowing plate (faces +z). */
function CedarPlate({ position, size }: { position: [number, number, number]; size: number }) {
  const { texture } = useCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, w, h);
    drawCedar(ctx, w / 2, 28, 16);
  });
  return (
    <mesh position={position}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/** The cedar from Develeb's logo as a voxel sculpture by the entrance. Click it. */
function VoxelCedar({ position }: { position: [number, number, number] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const cells = useMemo(() => {
    const out: { p: [number, number, number]; c: string }[] = [];
    const cell = 0.16;
    CEDAR_ROWS.forEach((n, r) => {
      const y = 0.6 + (CEDAR_ROWS.length - r) * cell;
      const depth = r >= 10 ? 0 : Math.floor(n / 3);
      for (let i = 0; i < n; i++)
        for (let k = -depth; k <= depth; k++) {
          if (Math.abs(k) === depth && depth > 0 && (i === 0 || i === n - 1)) continue;
          out.push({
            p: [(i - (n - 1) / 2) * cell, y, k * cell],
            c: r >= 10 ? GREEN_DARK : (i + r + k) % 3 === 0 ? "#34d3a2" : (i + k) % 4 === 0 ? GREEN_DARK : GREEN,
          });
        }
    });
    return out;
  }, []);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    cells.forEach((cell, i) => {
      o.position.set(...cell.p);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(cell.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [cells]);
  useFrame((_, delta) => {
    spin.current = Math.max(0, spin.current - delta * 2);
    if (group.current) group.current.rotation.y += delta * (0.15 + spin.current * 4);
  });
  const f = finishes();
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} material={plain(NAVY, 0.4)} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.05, 0.6, 40]} />
      </mesh>
      <mesh position={[0, 0.605, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.75, 0.9, 48]} />
        <meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={1.3} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.02, 0]} material={f.blackMetal}>
        <cylinderGeometry args={[1.08, 1.08, 0.04, 40]} />
      </mesh>
      <group ref={group}>
        <instancedMesh
          ref={mesh}
          args={[undefined, undefined, cells.length]}
          castShadow
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            spin.current = 1.5;
            sfx.sparkle();
            emitBurst({ position: new THREE.Vector3(position[0], 2, position[2]), kind: "sparkle", count: 24, colors: [GREEN, "#ffffff"], spread: 1 });
            useCityStore.getState().toast("Develeb, short for Developing Lebanon 🌲", "The cedar");
          }}
        >
          <boxGeometry args={[0.145, 0.145, 0.145]} />
          <meshStandardMaterial roughness={0.35} metalness={0.1} emissive={GREEN_DARK} emissiveIntensity={0.15} />
        </instancedMesh>
      </group>
      <Text position={[0, 0.3, 1.06]} fontSize={0.13} letterSpacing={0.08} color={GREEN} anchorX="center" anchorY="middle">
        DEVELEB · DEVELOPING LEBANON
      </Text>
      <Block position={[0, 1, 0]} size={[1.6, 2, 1.6]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Walls: events, jobs, designs, testimonials, newsletter, founders, partners
// ---------------------------------------------------------------------------

/** A flat canvas panel with a slim frame. Faces +z. */
function Panel({ position, rotationY = 0, width, height, map, frame = NAVY, onClick }: { position: [number, number, number]; rotationY?: number; width: number; height: number; map: THREE.Texture; frame?: string; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0, -0.025]} material={plain(frame, 0.4)}>
        <boxGeometry args={[width + 0.08, height + 0.08, 0.04]} />
      </mesh>
      <mesh onClick={onClick}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  );
}

function EventCard({ index, z }: { index: number; z: number }) {
  const event = EVENTS[index];
  const { texture } = useCanvas(512, 540, (ctx, w, h) => drawEventCard(ctx, w, h, event), index);
  return (
    <Panel
      position={[-W / 2 + 0.06, 2.35, z]}
      rotationY={Math.PI / 2}
      width={1.9}
      height={2}
      map={texture}
      onClick={(e) => {
        e.stopPropagation();
        sfx.pop();
        useCityStore.getState().toast(`${event[1]} · ${event[2]} · Online`, event[0]);
      }}
    />
  );
}

function EventsWall() {
  return (
    <OnWall side="left">
      <Text position={[-W / 2 + 0.05, 3.85, -9.4]} rotation-y={Math.PI / 2} fontSize={0.36} color={NAVY} anchorX="left" anchorY="middle">
        Our Latest Events
      </Text>
      <mesh position={[-W / 2 + 0.05, 3.56, -9.25]} rotation-y={Math.PI / 2} material={plain(NAVY, 0.5)}>
        <planeGeometry args={[0.35, 0.05]} />
      </mesh>
      {EVENTS.map((_, i) => (
        <EventCard key={i} index={i} z={-8.5 + i * 3.4} />
      ))}
    </OnWall>
  );
}

/** The "Find Your Next Job" kiosk: E or a click shows the next job. */
function JobKiosk({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  const job = useRef(0);
  const { ctx, texture } = useCanvas(512, 640, (c, w, h) => drawJobCard(c, w, h, 0));
  const next = () => {
    job.current = (job.current + 1) % JOBS.length;
    drawJobCard(ctx, 512, 640, job.current);
    texture.needsUpdate = true;
    sfx.click();
  };
  const where = useMemo(() => new THREE.Vector3(position[0], 0, position[2]), [position]);
  useProximity({ id: "develeb-jobs", label: "Next job", radius: 2, where, run: next });
  const f = finishes();
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.5, 0]} material={plain(NAVY, 0.4)} castShadow>
        <boxGeometry args={[0.5, 1, 0.35]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} material={f.blackMetal}>
        <boxGeometry args={[0.7, 0.04, 0.5]} />
      </mesh>
      <group position={[0, 1.55, 0.05]} rotation-x={-0.12}>
        <mesh position={[0, 0, -0.03]} material={f.blackMetal}>
          <boxGeometry args={[0.92, 1.12, 0.05]} />
        </mesh>
        <mesh
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            next();
          }}
        >
          <planeGeometry args={[0.84, 1.05]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
      <Block position={[0, 0.5, 0]} size={[0.6, 1, 0.45]} />
    </group>
  );
}

function JobsWall() {
  const { texture } = useCanvas(1600, 700, drawJobsTable);
  return (
    <OnWall side="right">
      <Panel position={[W / 2 - 0.06, 2.45, -6.2]} rotationY={-Math.PI / 2} width={7.4} height={3.24} map={texture} frame="#d1d5db" />
    </OnWall>
  );
}

/** Wouroud designed the website: three framed screens of it, with a heading. */
function DesignsWall() {
  const home = useCanvas(960, 600, drawMockHome);
  const jobs = useCanvas(960, 600, drawMockJobs);
  const events = useCanvas(960, 600, drawMockEvents);
  const shots: [THREE.Texture, string, number][] = [
    [home.texture, "Home", 2.1],
    [jobs.texture, "Jobs", 5.6],
    [events.texture, "Events", 9.1],
  ];
  return (
    <OnWall side="right">
      <Text position={[W / 2 - 0.05, 3.85, 5.6]} rotation-y={-Math.PI / 2} fontSize={0.3} color={NAVY} anchorX="center" anchorY="middle">
        I designed the Develeb website (UI/UX)
      </Text>
      <Text position={[W / 2 - 0.05, 3.52, 5.6]} rotation-y={-Math.PI / 2} fontSize={0.15} color={GREEN_DARK} anchorX="center" anchorY="middle">
        Figma → React · responsive, accessible, on-brand
      </Text>
      {shots.map(([map, label, z]) => (
        <group key={label}>
          <Panel position={[W / 2 - 0.06, 2.25, z]} rotationY={-Math.PI / 2} width={3.1} height={1.94} map={map} frame="#0b1b2b" />
          <Text position={[W / 2 - 0.05, 1.08, z]} rotation-y={-Math.PI / 2} fontSize={0.14} color={GREY} anchorX="center">
            {label}
          </Text>
        </group>
      ))}
    </OnWall>
  );
}

function Testimonial({ index, x, y }: { index: number; x: number; y: number }) {
  const { texture } = useCanvas(640, 420, (ctx, w, h) => drawTestimonial(ctx, w, h, TESTIMONIALS[index]), index);
  return <Panel position={[x, y, D / 2 - 0.06]} rotationY={Math.PI} width={2.9} height={1.9} map={texture} frame="#e5e7eb" />;
}

function FrontWall({ job }: { job: Experience }) {
  const newsletter = useCanvas(1200, 560, drawNewsletter);
  const hasan = useCanvas(500, 560, (ctx, w, h) => drawFounder(ctx, w, h, "Hasan Kataya", "Passionate about building communities and empowering developers to reach their full potential in tech."));
  const sam = useCanvas(500, 560, (ctx, w, h) => drawFounder(ctx, w, h, "Sam Shouman", "Dedicated to fostering knowledge sharing and creating opportunities for Lebanese tech talent globally."));
  const partners = useMemo(() => {
    const { ctx, texture } = canvasTexture(4096, 128);
    drawPartners(ctx, 4096, 128);
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = 0.5;
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => partners.dispose(), [partners]);
  useFrame((_, delta) => {
    partners.offset.x += delta * 0.03;
  });
  return (
    <OnWall side="front">
      {/* Why Join Us? */}
      <Text position={[-9.8, 4.8, D / 2 - 0.05]} rotation-y={Math.PI} fontSize={0.4} color={NAVY} anchorX="center" anchorY="middle">
        Why Join Us?
      </Text>
      <Text position={[-9.8, 4.42, D / 2 - 0.05]} rotation-y={Math.PI} fontSize={0.16} color={GREY} anchorX="center" anchorY="middle">
        {"Here's what our members say about us."}
      </Text>
      {TESTIMONIALS.map((_, i) => (
        <Testimonial key={i} index={i} x={-6.6 - (i % 3) * 3.2} y={i < 3 ? 3.25 : 1.2} />
      ))}
      {/* Partners strip above the door */}
      <group position={[0, 4.55, D / 2 - 0.05]} rotation-y={Math.PI}>
        <mesh position={[0, 0, -0.02]} material={plain(NAVY, 0.4)}>
          <boxGeometry args={[9.6, 0.62, 0.04]} />
        </mesh>
        <mesh>
          <planeGeometry args={[9.4, 0.5]} />
          <meshBasicMaterial map={partners} toneMapped={false} />
        </mesh>
        <Text position={[-4.6, 0.46, 0]} fontSize={0.16} color={NAVY} anchorX="left">
          Our Partners
        </Text>
      </group>
      {job.plaque && <Plaque text={job.plaque} x={-3.2} />}
      {/* Newsletter */}
      <Panel
        position={[8.6, 2.7, D / 2 - 0.06]}
        rotationY={Math.PI}
        width={5.2}
        height={2.43}
        map={newsletter.texture}
        onClick={(e) => {
          e.stopPropagation();
          sfx.coin();
          useCityStore.getState().toast("Weekly jobs, event invitations and industry tips (no email needed in this city) ✉️", "You're in the loop!");
        }}
      />
      {/* Founders */}
      <Text position={[14.6, 4.3, D / 2 - 0.05]} rotation-y={Math.PI} fontSize={0.3} color={NAVY} anchorX="center">
        Meet Our Founders
      </Text>
      <Panel position={[15.6, 2.65, D / 2 - 0.06]} rotationY={Math.PI} width={1.8} height={2.02} map={hasan.texture} frame="#e5e7eb" />
      <Panel position={[13.6, 2.65, D / 2 - 0.06]} rotationY={Math.PI} width={1.8} height={2.02} map={sam.texture} frame="#e5e7eb" />
    </OnWall>
  );
}

// ---------------------------------------------------------------------------
// The about wall: Develeb, the stats, and Wouroud's role
// ---------------------------------------------------------------------------

/** Where the about wall stands: left of the aisle, so the stage is in view from the door. */
const ABOUT = { x: -9.4, z: 2.6, width: 7 };

const STATS: [number, string, string][] = [
  [4000, "Members Joined", "In the Past Year"],
  [500, "Jobs Posted", "All Skill Levels"],
  [30, "Events Hosted", "Online and In-Person"],
];

function AboutWall({ job }: { job: Experience }) {
  const month = (m: string | null) =>
    m ? new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1).toLocaleString("en", { month: "short", year: "numeric" }) : "now";
  const role = job.roles[0];
  const front = useMemo(() => canvasTexture(1600, 760), []);
  const progress = useRef(0);
  const drawn = useRef(-1);
  const drawFront = (p: number) => {
    const { ctx, texture } = front;
    const w = 1600;
    const h = 760;
    ctx.fillStyle = OFFWHITE;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = font(64, "bold");
    ctx.fillText("Developing Lebanon's Tech Talent", w / 2, 92);
    ctx.fillStyle = "#475569";
    ctx.font = font(27);
    wrap(ctx, "Develeb, short for Developing Lebanon, is a developer-led community on a mission to up skill and elevate the quality of Lebanon's talent, leading to better opportunities and mitigating brain drain. It's all free of charge.", w / 2, 148, 1240, 38);
    STATS.forEach(([n, label, sub], i) => {
      const x = 170 + i * 440;
      box(ctx, x, 262, 380, 236, 16, "#ffffff", "#e7ecef");
      box(ctx, x + 166, 284, 48, 48, 10, MINT);
      ctx.fillStyle = GREEN;
      ctx.font = font(34, "bold");
      ctx.fillText("ϟ", x + 190, 320);
      ctx.fillStyle = INK;
      ctx.font = font(60, "bold");
      ctx.fillText(`${Math.round(n * p)}+`, x + 190, 400);
      ctx.font = font(28, "bold");
      ctx.fillText(label, x + 190, 446);
      ctx.fillStyle = GREY;
      ctx.font = font(21);
      ctx.fillText(sub, x + 190, 478);
    });
    box(ctx, 170, 540, 1260, 180, 16, NAVY);
    ctx.fillStyle = GREEN;
    ctx.font = font(26, "bold");
    ctx.fillText("MY ROLE", w / 2, 588);
    ctx.fillStyle = "#fff";
    ctx.font = font(38, "bold");
    ctx.fillText(`${role.title}`, w / 2, 638);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = font(26);
    ctx.fillText(`${month(role.start)} – ${month(role.end)} · ${job.location}${job.remote ? " · remote" : ""} · ${job.summary}`, w / 2, 684);
    ctx.textAlign = "left";
    texture.needsUpdate = true;
  };
  // The stats count up while the visitor is near.
  useFrame((_, delta) => {
    const dx = playerState.position.x - ABOUT.x;
    const dz = playerState.position.z - ABOUT.z;
    const near = dx * dx + dz * dz < 8 * 8 && dz > 0;
    progress.current = near ? Math.min(1, progress.current + delta / 1.6) : Math.max(0, progress.current - delta / 3);
    const eased = 1 - (1 - progress.current) ** 3;
    const step = Math.round(eased * 60);
    if (step !== drawn.current) {
      drawn.current = step;
      drawFront(Math.max(0.02, step / 60));
    }
  });
  useEffect(() => () => front.texture.dispose(), [front]);
  const back = useCanvas(1600, 760, (ctx, w, h) => {
    heroBackground(ctx, w, h);
    ctx.fillStyle = "#fff";
    ctx.font = font(56, "bold");
    ctx.fillText("What I did at Develeb", 70, 110);
    ctx.fillStyle = GREEN;
    ctx.fillRect(74, 132, 70, 8);
    job.highlights.forEach((t, i) => {
      const y = 180 + i * 140;
      box(ctx, 70, y, 980, 118, 12, "rgba(16,195,142,0.12)", "rgba(16,195,142,0.4)");
      ctx.fillStyle = GREEN;
      ctx.font = font(40, "bold");
      ctx.fillText(`0${i + 1}`, 96, y + 72);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = font(28);
      wrap(ctx, t, 180, y + 52, 840, 38);
    });
    ctx.fillStyle = "#fff";
    ctx.font = font(36, "bold");
    ctx.fillText("Tech", 1120, 220);
    job.tech.forEach((t, i) => {
      ctx.font = font(28, "bold");
      const tw = ctx.measureText(t).width + 48;
      box(ctx, 1120, 250 + i * 76, tw, 56, 28, GREEN);
      ctx.fillStyle = INK;
      ctx.fillText(t, 1144, 288 + i * 76);
    });
    drawCedar(ctx, 1450, 560, 12);
  });
  const WW = ABOUT.width;
  const WH = WW * (760 / 1600);
  return (
    <group position={[ABOUT.x, 0, ABOUT.z]}>
      <Batch>
        <mesh position={[0, (WH + 0.6) / 2, 0]} material={plain(NAVY, 0.45)} castShadow receiveShadow>
          <boxGeometry args={[WW + 0.4, WH + 0.6, 0.3]} />
        </mesh>
      </Batch>
      <mesh position={[0, 0.3 + WH / 2, 0.152]}>
        <planeGeometry args={[WW, WH]} />
        <meshBasicMaterial map={front.texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.3 + WH / 2, -0.152]} rotation-y={Math.PI}>
        <planeGeometry args={[WW, WH]} />
        <meshBasicMaterial map={back.texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, WH + 0.6, 0]}>
        <boxGeometry args={[WW + 0.4, 0.04, 0.32]} />
        <meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[WW / 2 + 0.2, (WH + 0.6) / 2, 0.15]} position={[0, (WH + 0.6) / 2, 0]} />
      </RigidBody>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Seating, desks and people
// ---------------------------------------------------------------------------

const S = Math.PI;
const E = Math.PI / 2;

/** Audience rows facing the stage, with an aisle down the middle. */
const AUDIENCE: Seat[] = [-6.5, -5.3, -4.1, -2.9].flatMap((z, r) =>
  [-4.7, -3.8, -2.9, -2.0, -1.1, 1.1, 2.0, 2.9, 3.8, 4.7].map((x, i) => workSeat(`aud-${r}-${i}`, x, z, S)),
);
/** Who is in the audience: [seat id, avatar]. */
const ATTENDEES: [string, string][] = [
  ["aud-0-2", "Male_Adult_04"],
  ["aud-0-6", "Female_Adult_15"],
  ["aud-1-4", "Male_Adult_16"],
  ["aud-1-8", "Female_Adult_02"],
  ["aud-2-1", "Female_Adult_06"],
  ["aud-3-5", "Male_Adult_10"],
];

/** The panel on stage: three armchairs angled toward the audience. */
const PANEL: [string, number, number, number][] = [
  ["panel-1", 1.6, STAGE.front - 1.9, -0.25],
  ["panel-2", 3.3, STAGE.front - 2.05, -0.1],
  ["panel-3", 5.0, STAGE.front - 1.9, 0.1],
];

/** The coworking table: laptops, and chairs on both long sides. */
const COWORK = { x: -10.5, z: 7, length: 4.2 };
const COWORK_SEATS: Seat[] = [-1.5, -0.5, 0.5, 1.5].flatMap((dx, i) => [
  workSeat(`cowork-n${i}`, COWORK.x + dx, COWORK.z - 0.5 - (DESK_REACH - 0.4), 0),
  workSeat(`cowork-s${i}`, COWORK.x + dx, COWORK.z + 0.5 + (DESK_REACH - 0.4), S),
]);
const COWORKERS: [string, string][] = [
  ["cowork-n1", "Male_Adult_07"],
  ["cowork-s2", "Female_Adult_04"],
  ["cowork-n3", "Male_Adult_19"],
];

/** Wouroud's design desk, facing her designs on the right wall. */
const DESIGN_DESK = { id: "design-desk", x: 13.9, z: 5.2, facing: E };

export function DevelebHub({ job }: { job: Experience }) {
  const f = finishes();
  const siteScreen = useCanvas(960, 600, drawMockHome);
  const figma = useCanvas(512, 300, drawFigma);
  const laptop = useCanvas(512, 300, (ctx, w, h) => {
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, w, h);
    const lines = ["const develeb = new Community('Lebanon');", "develeb.on('event', learn);", "await jobs.apply(nextRole);", "git push origin main"];
    ctx.font = `20px monospace`;
    lines.forEach((l, i) => {
      ctx.fillStyle = i % 2 ? GREEN : "#e6edf3";
      ctx.fillText(l, 16, 44 + i * 34);
    });
  });

  const people = useMemo(() => {
    const byId = new Map<string, Seat>([...AUDIENCE, ...COWORK_SEATS].map((s) => [s.id, s]));
    return [...ATTENDEES, ...COWORKERS].map(([id, who]) => ({ seat: byId.get(id)!, who }));
  }, []);
  const panelSeats = useMemo(() => PANEL.flatMap(([id, x, z, facing]) => sofaSeats(id, x, z, facing, 0.95).map((s) => ({ ...s, y: STAGE.height }))), []);
  const free = useMemo(() => {
    const taken = new Set(people.map((p) => p.seat.id));
    return [
      ...AUDIENCE.filter((s) => !taken.has(s.id)),
      ...COWORK_SEATS.filter((s) => !taken.has(s.id)),
      ...panelSeats,
      workSeat(DESIGN_DESK.id, DESIGN_DESK.x, DESIGN_DESK.z, DESIGN_DESK.facing),
    ];
  }, [people, panelSeats]);

  const walkers = useMemo(
    () =>
      makeWalkers("room-develeb", "business", [], [
        [
          [-8.5, -7.6],
          [8.5, -7.6],
          [8.5, 1.2],
          [-8.5, 1.2],
        ],
        [
          [6.5, 10.5],
          [-6.5, 10.5],
          [-6.5, 9],
          [6.5, 9],
        ],
      ]),
    [],
  );

  const [deskX, deskZ] = ahead(DESIGN_DESK.x, DESIGN_DESK.z, DESIGN_DESK.facing, DESK_REACH);
  const [plateX, plateZ] = ahead(deskX, deskZ, DESIGN_DESK.facing, -0.28, -0.6);

  return (
    <group>
      <CommunityShell />
      <HeroWall />
      <Stage />
      <EventsWall />
      <JobsWall />
      <DesignsWall />
      <FrontWall job={job} />
      <AboutWall job={job} />
      <VoxelCedar position={[-5.2, 0, 9.6]} />
      <JobKiosk position={[15.6, 0, -1.4]} rotationY={-Math.PI / 2 - 0.4} />

      <Batch>
        {AUDIENCE.map((s, i) => (
          <ConferenceChair key={s.id} position={[s.x, 0, s.z]} facing={s.facing} color={i % 10 < 5 ? GREEN : NAVY_2} />
        ))}
        {PANEL.map(([id, x, z, facing]) => (
          <Sofa key={id} position={[x, STAGE.height, z]} facing={facing} length={0.95} leather="emerald" />
        ))}
        {/* Coworking table */}
        <Table position={[COWORK.x, 0, COWORK.z]} width={COWORK.length} depth={1} top="walnut" />
        {COWORK_SEATS.map((s) => (
          <ConferenceChair key={s.id} position={[s.x, 0, s.z]} facing={s.facing} color={OFFWHITE} />
        ))}
        {COWORK_SEATS.map((s, i) => {
          const [lx, lz] = ahead(s.x, s.z, s.facing, 0.62);
          return (
            <group key={`lap${s.id}`} position={[lx, 0.74, lz]} rotation-y={s.facing + Math.PI}>
              <mesh position={[0, 0.008, 0]} material={f.chrome}>
                <boxGeometry args={[0.34, 0.015, 0.24]} />
              </mesh>
              {i % 3 !== 2 && (
                <mesh position={[0, 0.12, 0.12]} rotation-x={0.25} material={f.chrome}>
                  <boxGeometry args={[0.34, 0.23, 0.01]} />
                </mesh>
              )}
            </group>
          );
        })}
        {/* Standing tables for networking, with coffee */}
        {[
          [7.4, 6.4],
          [10, 8.6],
          [-7.6, 1.2],
        ].map(([x, z]) => (
          <group key={`${x}${z}`}>
            <mesh position={[x, 0.55, z]} material={f.blackMetal}>
              <cylinderGeometry args={[0.04, 0.04, 1.1, 10]} />
            </mesh>
            <mesh position={[x, 0.02, z]} material={f.blackMetal}>
              <cylinderGeometry args={[0.25, 0.27, 0.04, 20]} />
            </mesh>
            <mesh position={[x, 1.1, z]} material={plain(OFFWHITE, 0.3)} castShadow>
              <cylinderGeometry args={[0.35, 0.35, 0.03, 28]} />
            </mesh>
            {[0, 1].map((k) => (
              <mesh key={k} position={[x + (k ? 0.12 : -0.1), 1.16, z + (k ? -0.08 : 0.1)]} material={plain(k ? GREEN : OFFWHITE, 0.5)}>
                <cylinderGeometry args={[0.04, 0.035, 0.1, 14]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* Plants */}
        {[
          [-16.8, -11.8],
          [16.8, -11.8],
          [-16.8, 11.8],
          [16.8, 11.8],
          [-8.2, -11.8],
          [8.2, -11.8],
          [3.4, 11.6],
          [-16.6, 3.2],
        ].map(([x, z], i) => (
          <TallPlant key={i} position={[x, 0, z]} seed={i + 11} height={1.8 + (i % 2) * 0.3} />
        ))}
      </Batch>
      {[
        [7.4, 6.4],
        [10, 8.6],
        [-7.6, 1.2],
      ].map(([x, z]) => (
        <Block key={`${x}${z}`} position={[x, 0.55, z]} size={[0.5, 1.1, 0.5]} />
      ))}

      {/* Wouroud's design desk: the site on one screen, the design tool on the other */}
      <Workstation x={DESIGN_DESK.x} z={DESIGN_DESK.z} facing={DESIGN_DESK.facing} screens={[siteScreen.texture, figma.texture]} extras={["plant", "mug"]} leather="black" />
      <group position={[deskX, DESK_TOP, deskZ]} rotation-y={DESIGN_DESK.facing}>
        {/* Drawing tablet and pen */}
        <mesh position={[-0.55, 0.006, -0.18]} rotation-y={0.2} material={f.blackMetal}>
          <boxGeometry args={[0.32, 0.012, 0.22]} />
        </mesh>
        <mesh position={[-0.42, 0.016, -0.2]} rotation={[0, 0.6, Math.PI / 2]} material={plain(GREEN, 0.4)}>
          <cylinderGeometry args={[0.006, 0.006, 0.15, 6]} />
        </mesh>
      </group>
      {/* Nameplate on the desk's corner, readable from the room */}
      <Nameplate
        position={[plateX, DESK_TOP, plateZ]}
        rotationY={DESIGN_DESK.facing}
        name="Wouroud El Khaldi"
        title="UI/UX Designer & Full Stack"
      />
      {/* Laptop screens at the coworking table (the open ones) */}
      {COWORK_SEATS.map((s, i) => {
        if (i % 3 === 2) return null;
        const [lx, lz] = ahead(s.x, s.z, s.facing, 0.62);
        return (
          <group key={`scr${s.id}`} position={[lx, 0.74, lz]} rotation-y={s.facing + Math.PI}>
            <mesh position={[0, 0.12, 0.114]} rotation-x={0.25} rotation-y={Math.PI}>
              <planeGeometry args={[0.31, 0.2]} />
              <meshBasicMaterial map={laptop.texture} toneMapped={false} />
            </mesh>
          </group>
        );
      })}

      {people.map(({ seat, who }) => (
        <Suspense key={seat.id} fallback={null}>
          <SeatedPerson id={who} seat={seat} />
        </Suspense>
      ))}
      <Seats seats={free} />
      <Pedestrians walkers={walkers} />
    </group>
  );
}

