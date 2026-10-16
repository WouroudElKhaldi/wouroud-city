"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { createContext, useContext, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Skill } from "@/content/schema";
import { signatureFor } from "@/world/signatures";
import { sfx } from "@/world/sfx";
import { OnWall, useRoom } from "./InteriorScene";
import { emitBurst } from "./Particles";
import { Text } from "./Text3D";
import { useProximity } from "./useProximity";

/**
 * What makes each skill's room its own: its colors, the logo backdrop and an interactive
 * centerpiece that shows what the technology does. Fourteen kinds of centerpiece, each fed with
 * that skill's own words (its keywords, code, layers…), so React's tree re-renders, Docker's
 * containers stack, Git's branches take commits and SQL tables answer queries.
 */

export type Demo =
  | "letters"
  | "tags"
  | "boxmodel"
  | "tree"
  | "server"
  | "database"
  | "containers"
  | "branches"
  | "kanban"
  | "store"
  | "cloud"
  | "design"
  | "flow"
  | "layers";

export type SkillTheme = {
  /** Second color for the room (the accent comes from the skill's signature) */
  second: string;
  /** Wall backdrop color behind the logo */
  backdrop: string;
  demo: Demo;
  /** Words the centerpiece uses (tags, tables, layers, nodes…) */
  words: string[];
  /** Lines the code terminal runs */
  code: string[];
  /** A short line under the name on the backdrop */
  tagline: string;
};

const T = (second: string, backdrop: string, demo: Demo, tagline: string, words: string[], code: string[]): SkillTheme => ({
  second,
  backdrop,
  demo,
  tagline,
  words,
  code,
});

export const SKILL_THEMES: Record<string, SkillTheme> = {
  javascript: T("#323330", "#1f1f1c", "letters", "The language of the web", ["J", "S"], ["const greet = (name) => `Hi ${name}!`;", "[1, 2, 3].map((n) => n * 2) // [2, 4, 6]", "await fetch('/api/city').then((r) => r.json())"]),
  typescript: T("#ffffff", "#1d4f8c", "letters", "JavaScript that scales", ["T", "S"], ["type Building = { id: string; floors: number };", "function build<T extends Building>(b: T): T { return b; }", "const city: Readonly<City> = load();"]),
  php: T("#4f5b93", "#2b3156", "letters", "Server-side since 1995", ["p", "h", "p"], ["<?php echo \"Hello, Tripoli!\"; ?>", "$users = array_filter($all, fn($u) => $u->active);", "public function __construct(private Repo $repo) {}"]),
  python: T("#3776ab", "#1e3a5f", "letters", "Readable, powerful, everywhere", ["P", "y"], ["print(f\"Hello, {name}!\")", "squares = [n * n for n in range(10)]", "model.fit(X_train, y_train)"]),
  html: T("#f1662a", "#3b1a10", "tags", "The structure of every page", ["<html>", "<body>", "<main>", "<section>", "<h1>"], ["<main><h1>Wouroud's City</h1></main>", "<button aria-label=\"Enter\">Enter</button>", "<img src=\"city.png\" alt=\"The city\" />"]),
  css: T("#ebebeb", "#16326e", "boxmodel", "Making it beautiful", ["margin", "border", "padding", "content"], [".city { display: grid; gap: 2rem; }", "@media (max-width: 640px) { .hud { font-size: 14px; } }", "transition: transform 200ms ease-out;"]),
  react: T("#20232a", "#20232a", "tree", "Components all the way down", ["App", "City", "Hud", "District", "Building", "Person"], ["const [open, setOpen] = useState(false);", "useEffect(() => subscribe(store), []);", "<City districts={8} onEnter={goTo} />"]),
  nextjs: T("#000000", "#0a0a0a", "tree", "The React framework", ["layout", "page", "loading", "route", "server", "client"], ["export default async function Page() { … }", "export const revalidate = 3600;", "import Image from 'next/image';"]),
  vue: T("#35495e", "#213547", "tree", "The progressive framework", ["App", "Router", "View", "Card", "Button", "Icon"], ["<template><h1>{{ title }}</h1></template>", "const count = ref(0);", "watch(query, fetchResults);"]),
  angular: T("#c3002f", "#3a0010", "tree", "Platform for big apps", ["AppModule", "Router", "Shell", "List", "Item", "Pipe"], ["@Component({ selector: 'app-city' })", "constructor(private http: HttpClient) {}", "this.items$ = this.store.select(selectItems);"]),
  shadcn: T("#18181b", "#09090b", "boxmodel", "Beautiful components you own", ["Card", "CardHeader", "CardContent", "Button"], ["npx shadcn add dialog", "<Button variant=\"outline\">Cancel</Button>", "cn('rounded-lg', isActive && 'ring-2')"]),
  mui: T("#0a1929", "#0a1929", "boxmodel", "Material components for React", ["Box", "Paper", "Stack", "Typography"], ["<Button variant=\"contained\">Save</Button>", "sx={{ p: 2, borderRadius: 2 }}", "createTheme({ palette: { mode: 'dark' } })"]),
  daisyui: T("#ff9903", "#2a1a2e", "boxmodel", "Tailwind components, themed", ["card", "card-body", "btn", "badge"], ["<button class=\"btn btn-primary\">Go</button>", "<div class=\"card bg-base-100 shadow\">", "data-theme=\"cupcake\""]),
  "react-native": T("#20232a", "#1b1f27", "tree", "Native apps with React", ["App", "Navigator", "Screen", "List", "Row", "Text"], ["<View style={styles.card}><Text>Hi</Text></View>", "const nav = useNavigation();", "Platform.OS === 'ios' ? 12 : 8"]),
  nodejs: T("#333333", "#1a2e12", "server", "JavaScript on the server", ["GET /api", "200 OK", "POST /orders", "201 Created"], ["import { createServer } from 'node:http';", "process.on('SIGTERM', shutdown);", "await fs.readFile('city.json', 'utf8');"]),
  express: T("#ffffff", "#1c1c1c", "server", "Minimal web framework", ["GET /", "200", "POST /login", "401"], ["app.get('/health', (req, res) => res.json({ ok: true }));", "app.use(express.json());", "router.post('/orders', auth, create);"]),
  nestjs: T("#ea2845", "#24060c", "server", "Structured Node.js", ["Controller", "Service", "Guard", "Module"], ["@Controller('orders') export class OrdersController {}", "@Injectable() export class OrdersService {}", "@UseGuards(AuthGuard('jwt'))"]),
  laravel: T("#ff2d20", "#2a0a08", "server", "The PHP framework for artisans", ["Route", "Controller", "Model", "Blade"], ["Route::get('/jobs', [JobController::class, 'index']);", "Order::where('paid', true)->latest()->get();", "php artisan migrate --seed"]),
  postgresql: T("#336791", "#14273a", "database", "The advanced open-source database", ["users", "orders", "skills"], ["SELECT name FROM skills WHERE level >= 8;", "CREATE INDEX ON orders (created_at);", "BEGIN; UPDATE … ; COMMIT;"]),
  mysql: T("#f29111", "#0f2b3a", "database", "The world's most popular open-source DB", ["customers", "products", "invoices"], ["SELECT * FROM products ORDER BY price DESC LIMIT 5;", "ALTER TABLE users ADD COLUMN phone VARCHAR(20);", "SHOW PROCESSLIST;"]),
  mongodb: T("#13aa52", "#0c2617", "database", "Documents, flexibly", ["users", "posts", "events"], ["db.posts.find({ tags: 'react' }).limit(10)", "db.users.createIndex({ email: 1 }, { unique: true })", "aggregate([{ $group: { _id: '$city', n: { $sum: 1 } } }])"]),
  firebase: T("#ffca28", "#2b1d05", "database", "Build and ship fast", ["users", "chats", "presence"], ["onSnapshot(doc(db, 'rooms', id), render);", "await signInWithPopup(auth, google);", "setDoc(ref, data, { merge: true })"]),
  supabase: T("#3ecf8e", "#0f1f18", "database", "Postgres, auth and storage", ["profiles", "bookings", "files"], ["supabase.from('profiles').select('*').eq('id', uid)", "create policy \"own rows\" on profiles using (auth.uid() = id);", "supabase.storage.from('avatars').upload(path, file)"]),
  prisma: T("#5a67d8", "#0c1225", "database", "Type-safe database access", ["User", "Order", "Product"], ["prisma.user.findMany({ include: { orders: true } })", "model Order { id Int @id @default(autoincrement()) }", "npx prisma migrate dev"]),
  typeorm: T("#fe0902", "#25080a", "database", "ORM for TypeScript", ["User", "Post", "Comment"], ["@Entity() export class User { @PrimaryGeneratedColumn() id: number; }", "repo.find({ relations: { posts: true } })", "dataSource.runMigrations()"]),
  sequelize: T("#52b0e7", "#0c2233", "database", "ORM for Node.js", ["User", "Task", "Project"], ["User.findAll({ where: { active: true } })", "sequelize.define('Task', { title: DataTypes.STRING })", "await sequelize.sync()"]),
  docker: T("#2496ed", "#0b2a45", "containers", "Ship it in a container", ["web", "api", "db", "redis", "worker"], ["docker compose up -d --build", "FROM node:24-alpine", "docker logs -f api"]),
  git: T("#f05032", "#2a0f0a", "branches", "Every change, remembered", ["main", "feature", "fix"], ["git switch -c feature/city", "git commit -m \"ship it, not perfect\"", "git rebase -i HEAD~3"]),
  "github-gitlab": T("#6e40c9", "#161b22", "branches", "Collaborate, review, ship", ["main", "PR #42", "review"], ["gh pr create --fill", "git push -u origin feature/city", "on: [push, pull_request]"]),
  jira: T("#0052cc", "#0a1e3d", "kanban", "Plan, track, deliver", ["To do", "In progress", "Review", "Done"], ["CITY-101 Add the race track", "CITY-102 Realistic trees", "CITY-103 Café menus"]),
  rest: T("#22c55e", "#0b2215", "server", "Resources over HTTP", ["GET /users", "200", "PATCH /users/7", "204"], ["GET /api/v1/projects?page=2", "Content-Type: application/json", "HTTP/1.1 201 Created"]),
  graphql: T("#e10098", "#2a0420", "server", "Ask for exactly what you need", ["query", "{ user", "projects", "200 OK" ], ["query { user(id: 7) { name projects { name } } }", "type Query { skills: [Skill!]! }", "mutation { addSkill(name: \"R3F\") { id } }"]),
  redux: T("#764abc", "#1e1230", "store", "Predictable state", ["ADD_ITEM", "REMOVE_ITEM", "SET_FILTER"], ["dispatch(addItem(product))", "const items = useSelector(selectItems);", "createSlice({ name: 'cart', initialState, reducers })"]),
  zustand: T("#443e38", "#2b2620", "store", "Bear-necessities state", ["goTo", "sit", "toast"], ["const useCity = create((set) => ({ scene: 'hub' }))", "useCity.getState().goTo('arcade')", "const scene = useCity((s) => s.scene);"]),
  gcp: T("#4285f4", "#0d1f3c", "cloud", "Google Cloud Platform", ["Cloud Run", "Storage", "Pub/Sub"], ["gcloud run deploy city --source .", "gsutil cp build.zip gs://city-assets", "gcloud pubsub topics publish orders"]),
  cpanel: T("#ff6c2c", "#2a1308", "cloud", "Classic web hosting", ["Domains", "Files", "MySQL"], ["public_html/index.php", "AddHandler application/x-httpd-php .php", "crontab: */5 * * * * php artisan schedule:run"]),
  aapanel: T("#20a53a", "#0b2412", "cloud", "Server panel for VPS", ["Nginx", "PHP", "SSL"], ["server { listen 443 ssl; server_name city.dev; }", "certbot renew --quiet", "systemctl reload nginx"]),
  figma: T("#a259ff", "#1e1e1e", "design", "Design together", ["#f24e1e", "#ff7262", "#a259ff", "#1abcfe", "#0acf83"], ["Frame → Auto layout → Gap 16", "Components: Button / Primary / Hover", "Prototype → On click → Navigate to"]),
  uiux: T("#f6c453", "#24183d", "design", "People first", ["#7c3aed", "#5eead4", "#f6c453", "#d53f8c", "#1a103d"], ["Research → Wireframe → Prototype → Test", "Contrast 4.5:1 for body text", "One primary action per screen"]),
  architecture: T("#5eead4", "#13293d", "layers", "How the pieces fit", ["Client", "API gateway", "Services", "Queue", "Database"], ["Client → Gateway → Service → DB", "Write path async through the queue", "Every query carries tenant_id"]),
  "system-design": T("#a78bfa", "#1d1638", "layers", "Information systems, designed", ["Users", "Processes", "Data", "Reports"], ["ERD: User 1—* Order *—1 Product", "Use case: place an order", "DFD level 1: orders → billing"]),
  "api-dev": T("#f97316", "#2a1406", "server", "Contracts between systems", ["POST /trades", "201", "GET /trades/7", "200"], ["openapi: 3.1.0", "rate limit: 100 req/min per key", "Idempotency-Key: 4f1c…"]),
  n8n: T("#ea4b71", "#1f0f1a", "flow", "Workflows with AI agents", ["Webhook", "AI Agent", "Database", "Slack"], ["Trigger: new form entry", "AI Agent: summarize and tag", "If priority = high → Slack"]),
};

/** A theme for any skill: its own, or one made from its category. */
export function skillTheme(skill: Skill): SkillTheme {
  const own = SKILL_THEMES[skill.id];
  if (own) return own;
  const byCat: Record<string, Demo> = { languages: "letters", frontend: "tree", backend: "server", databases: "database", tools: "containers", state: "store", hosting: "cloud", design: "design", architecture: "layers", ai: "flow" };
  return T("#ffffff", "#1a103d", byCat[skill.category] ?? "letters", skill.name, skill.name.slice(0, 3).split(""), [`// ${skill.name}`]);
}

const pointer = {
  onPointerOver: () => (document.body.style.cursor = "pointer"),
  onPointerOut: () => (document.body.style.cursor = ""),
};
const clicked = (e: ThreeEvent<MouseEvent>) => {
  if (e.delta > 6) return false;
  e.stopPropagation();
  return true;
};

/** The skill's colors on the room: a backdrop on the back wall, neon lines and a rug. */
export function SkillDressing({ skill, theme, accent }: { skill: Skill; theme: SkillTheme; accent: string }) {
  const { width: W, depth: D, height: H } = useRoom();
  const signature = useMemo(() => signatureFor(skill.id, skill.name), [skill.id, skill.name]);
  const logo = signature?.text ?? skill.name;
  return (
    <group>
      <OnWall side="back">
        <group position={[0, 0, -D / 2 + 0.03]}>
          <mesh position={[0, H / 2 + 0.6, 0]}>
            <planeGeometry args={[W - 1, H - 1.2]} />
            <meshStandardMaterial color={theme.backdrop} roughness={0.7} />
          </mesh>
          <Text position={[-W / 2 + 1.6, H - 1.15, 0.02]} fontSize={0.95} color={accent} anchorX="left" anchorY="middle">
            {logo}
          </Text>
          <Text position={[-W / 2 + 1.6, H - 1.95, 0.02]} fontSize={0.32} color={theme.second === theme.backdrop ? "#ffffff" : theme.second} anchorX="left" anchorY="middle">
            {`${skill.name} · ${theme.tagline}`}
          </Text>
          <mesh position={[0, 1.25, 0.01]}>
            <planeGeometry args={[W - 1, 0.06]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </group>
      </OnWall>
      {/* A rug in the skill's colors under the centerpiece */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, -3]} receiveShadow>
        <circleGeometry args={[3.2, 64]} />
        <meshStandardMaterial color={theme.backdrop} roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.014, -3]}>
        <ringGeometry args={[3.05, 3.2, 64]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The interactive centerpiece for the skill. */
export function SkillCenterpiece({ skill, theme, accent }: { skill: Skill; theme: SkillTheme; accent: string }) {
  const props = { theme, accent, name: skill.name };
  switch (theme.demo) {
    case "letters":
      return <LetterBlocks {...props} />;
    case "tags":
      return <NestingTags {...props} />;
    case "boxmodel":
      return <BoxModel {...props} />;
    case "tree":
      return <ComponentTree {...props} />;
    case "server":
      return <RequestResponse {...props} />;
    case "database":
      return <QueryMachine {...props} />;
    case "containers":
      return <ContainerStack {...props} />;
    case "branches":
      return <BranchGraph {...props} />;
    case "kanban":
      return <Kanban {...props} />;
    case "store":
      return <StoreOrb {...props} />;
    case "cloud":
      return <DeployCloud {...props} />;
    case "design":
      return <DesignFrames {...props} />;
    case "flow":
      return <Workflow {...props} />;
    case "layers":
      return <LayerStack {...props} />;
  }
}

type DemoProps = { theme: SkillTheme; accent: string; name: string };
/** Where the centerpiece stands: the old lab rooms use the default, skill houses set their hall's spot. */
const CenterContext = createContext<[number, number, number]>([0, 0, -3]);
const useCenter = () => useContext(CenterContext);
export function CenterAt({ at, children }: { at: [number, number, number]; children: React.ReactNode }) {
  return <CenterContext value={at}>{children}</CenterContext>;
}

/** Everything here is centered on the rug; E near it does the same as a click. */
function useDemoAction(label: string, run: () => void) {
  const c = useCenter();
  const where = useMemo(() => new THREE.Vector3(c[0], 0, c[2] + 3), [c]);
  useProximity({ id: `demo-${label}`, label, radius: 2.4, where, run });
}

function solid(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} {...extra} />;
}

function Plinth({ accent }: { accent: string }) {
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.6, 0.25, 1.6]} position={[0, 0.25, 0]} />
      </RigidBody>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.7, 1.85, 0.4, 48]} />
        <meshStandardMaterial color="#17151c" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.41, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.4, 1.6, 48]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
    </group>
  );
}

const burst = (c: [number, number, number], y: number, colors: string[], count = 24) =>
  emitBurst({ position: new THREE.Vector3(c[0], y, c[2]), kind: "sparkle", count, colors, spread: 1 });

// --- Languages: giant letters of the logo that jump when clicked -----------------------------

function LetterBlocks({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const blocks = useRef<(THREE.Group | null)[]>([]);
  const hits = useRef<number[]>(theme.words.map(() => -10));
  const jump = (i: number) => {
    hits.current[i] = performance.now() / 1000;
    sfx.pop();
    burst(C, 2.4, [accent, "#ffffff"], 12);
  };
  useDemoAction(`Bounce the ${name} letters`, () => theme.words.forEach((_, i) => window.setTimeout(() => jump(i), i * 150)));
  useFrame(() => {
    const t = performance.now() / 1000;
    blocks.current.forEach((b, i) => {
      if (!b) return;
      const age = t - hits.current[i];
      b.position.y = 0.4 + 0.8 + (age < 0.8 ? Math.sin((age / 0.8) * Math.PI) * 0.9 : Math.sin(t * 1.5 + i) * 0.05);
      b.rotation.y = age < 0.8 ? age * Math.PI * 2.5 : Math.sin(t * 0.7 + i) * 0.2;
    });
  });
  const n = theme.words.length;
  return (
    <group position={C}>
      <Plinth accent={accent} />
      {theme.words.map((w, i) => (
        <group
          key={i}
          ref={(el) => void (blocks.current[i] = el)}
          position={[(i - (n - 1) / 2) * 1.05, 1.2, 0]}
          onClick={(e) => clicked(e) && jump(i)}
          {...pointer}
        >
          <mesh castShadow>
            <boxGeometry args={[0.9, 0.9, 0.9]} />
            {solid(accent)}
          </mesh>
          {[0.46, -0.46].map((z) => (
            <Text key={z} position={[0, 0, z]} rotation-y={z > 0 ? 0 : Math.PI} fontSize={0.62} color={theme.second === accent ? "#000000" : theme.second} anchorX="center" anchorY="middle">
              {w}
            </Text>
          ))}
        </group>
      ))}
    </group>
  );
}

// --- HTML: nested tag blocks that open and close ---------------------------------------------

function NestingTags({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const [open, setOpen] = useState(theme.words.length);
  const toggle = () => {
    setOpen((o) => (o <= 1 ? theme.words.length : o - 1));
    sfx.click();
  };
  useDemoAction(`Nest the ${name} tags`, toggle);
  return (
    <group position={C} onClick={(e) => clicked(e) && toggle()} {...pointer}>
      <Plinth accent={accent} />
      {theme.words.slice(0, open).map((tag, i) => {
        const s = 2.6 - i * 0.45;
        return (
          <group key={tag} position={[0, 0.45 + i * 0.32, 0]}>
            <mesh castShadow>
              <boxGeometry args={[s, 0.28, s * 0.6]} />
              {solid(i % 2 ? theme.second : accent, { transparent: true, opacity: 0.92 })}
            </mesh>
            <Text position={[0, 0, s * 0.3 + 0.01]} fontSize={0.16} color={i % 2 ? accent : "#ffffff"} anchorX="center" anchorY="middle">
              {`${tag} … ${tag.replace("<", "</")}`}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// --- CSS / UI kits: the box model, restyled on click -----------------------------------------

const STYLES = [
  { radius: 0, colors: ["#f6c453", "#f97316", "#22c55e", "#3b82f6"] },
  { radius: 0.25, colors: ["#fecdd3", "#f472b6", "#a78bfa", "#ffffff"] },
  { radius: 0.5, colors: ["#1e293b", "#475569", "#94a3b8", "#f8fafc"] },
];

function BoxModel({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const [style, setStyle] = useState(0);
  const restyle = () => {
    setStyle((s) => (s + 1) % STYLES.length);
    sfx.sparkle();
    burst(C, 2, [accent, "#ffffff"]);
  };
  useDemoAction(`Restyle the ${name} box`, restyle);
  const st = STYLES[style];
  return (
    <group position={C} onClick={(e) => clicked(e) && restyle()} {...pointer}>
      <Plinth accent={accent} />
      {theme.words.map((layer, i) => {
        const s = 2.4 - i * 0.5;
        const scale = 1 - st.radius * 0.1;
        return (
          <group key={layer} position={[0, 1.6, 0]} scale={scale}>
            <mesh>
              <boxGeometry args={[s, s * 0.8, 0.1 + i * 0.12]} />
              <meshStandardMaterial color={st.colors[i % 4]} transparent opacity={i === theme.words.length - 1 ? 1 : 0.55} roughness={0.3} />
            </mesh>
            <Text position={[-s / 2 + 0.08, s * 0.4 - 0.12, 0.06 + i * 0.06]} fontSize={0.13} color={i > 1 ? "#1a103d" : "#1a103d"} anchorX="left" anchorY="middle">
              {layer}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// --- React & co: a component tree that re-renders -------------------------------------------

function ComponentTree({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const nodes = useRef<THREE.MeshStandardMaterial[]>([]);
  const renderAt = useRef(-10);
  const layout = useMemo(() => {
    const w = theme.words;
    // Root, two children, three grandchildren.
    return [
      { word: w[0], x: 0, y: 3.2, parent: -1, depth: 0 },
      { word: w[1], x: -1.2, y: 2.3, parent: 0, depth: 1 },
      { word: w[2], x: 1.2, y: 2.3, parent: 0, depth: 1 },
      { word: w[3], x: -1.8, y: 1.3, parent: 1, depth: 2 },
      { word: w[4], x: -0.6, y: 1.3, parent: 1, depth: 2 },
      { word: w[5], x: 1.2, y: 1.3, parent: 2, depth: 2 },
    ].filter((n) => n.word);
  }, [theme.words]);
  const rerender = () => {
    renderAt.current = performance.now() / 1000;
    sfx.sparkle();
  };
  useDemoAction(`Re-render the ${name} tree`, rerender);
  useFrame(() => {
    const age = performance.now() / 1000 - renderAt.current;
    nodes.current.forEach((m, i) => {
      const d = layout[i]?.depth ?? 0;
      const lit = age > d * 0.25 && age < d * 0.25 + 0.5;
      m.emissiveIntensity = lit ? 2.4 : 0.35;
    });
  });
  return (
    <group position={C} onClick={(e) => clicked(e) && rerender()} {...pointer}>
      <Plinth accent={accent} />
      {layout.map((n, i) => {
        const p = layout[n.parent];
        return (
          <group key={n.word}>
            {p && (
              <mesh
                position={[(n.x + p.x) / 2, (n.y + p.y) / 2, 0]}
                rotation-z={Math.atan2(p.x - n.x, n.y - p.y) * -1}
              >
                <cylinderGeometry args={[0.025, 0.025, Math.hypot(p.x - n.x, p.y - n.y), 6]} />
                <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
              </mesh>
            )}
            <mesh position={[n.x, n.y, 0]} castShadow>
              <boxGeometry args={[1.05, 0.42, 0.18]} />
              <meshStandardMaterial ref={(m) => void (m && (nodes.current[i] = m))} color={theme.backdrop} emissive={accent} emissiveIntensity={0.35} />
            </mesh>
            {[0.1, -0.1].map((z) => (
              <Text key={z} position={[n.x, n.y, z]} rotation-y={z > 0 ? 0 : Math.PI} fontSize={0.15} color="#ffffff" anchorX="center" anchorY="middle">
                {`<${n.word} />`}
              </Text>
            ))}
          </group>
        );
      })}
    </group>
  );
}

// --- APIs and servers: a request flies to the server and the response comes back ------------

function RequestResponse({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const packet = useRef<THREE.Group>(null);
  const sentAt = useRef(-10);
  const [pair, setPair] = useState(0);
  const send = () => {
    sentAt.current = performance.now() / 1000;
    setPair((p) => (p + 2) % Math.max(2, theme.words.length));
    sfx.click();
  };
  useDemoAction(`Send a ${name} request`, send);
  const req = theme.words[pair] ?? "GET /";
  const res = theme.words[pair + 1] ?? "200 OK";
  useFrame(() => {
    const age = performance.now() / 1000 - sentAt.current;
    if (!packet.current) return;
    packet.current.visible = age < 2;
    const k = age < 1 ? age : 2 - age;
    packet.current.position.set(-1.6 + Math.max(0, Math.min(1, k)) * 3.2, 1.5 + Math.sin(Math.min(1, k) * Math.PI) * 0.5, 0);
  });
  return (
    <group position={C} onClick={(e) => clicked(e) && send()} {...pointer}>
      <Plinth accent={accent} />
      {/* Client laptop */}
      <group position={[-1.7, 0.42, 0]}>
        <mesh position={[0, 0.03, 0]} castShadow>
          <boxGeometry args={[0.8, 0.05, 0.55]} />
          {solid("#2a2a30", { metalness: 0.6 })}
        </mesh>
        <mesh position={[0, 0.3, -0.26]} rotation-x={-0.25}>
          <boxGeometry args={[0.8, 0.5, 0.03]} />
          <meshStandardMaterial color="#111" emissive={accent} emissiveIntensity={0.4} />
        </mesh>
      </group>
      {/* Server rack */}
      <group position={[1.7, 0.42, 0]}>
        <mesh position={[0, 0.8, 0]} castShadow>
          <boxGeometry args={[0.7, 1.6, 0.6]} />
          {solid("#1c1b20", { metalness: 0.6 })}
        </mesh>
        {[0.3, 0.6, 0.9, 1.2].map((y) => (
          <mesh key={y} position={[0, y, 0.31]}>
            <boxGeometry args={[0.5, 0.06, 0.01]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={packet} visible={false}>
        <mesh>
          <sphereGeometry args={[0.14, 16, 12]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </group>
      <Text position={[0, 2.7, 0]} fontSize={0.22} color="#ffffff" anchorX="center">
        {`${req}  →  ${res}`}
      </Text>
    </group>
  );
}

// --- Databases: drums of tables and a query that lights up rows -----------------------------

function QueryMachine({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const [table, setTable] = useState(0);
  const rows = useRef<THREE.MeshStandardMaterial[]>([]);
  const queriedAt = useRef(-10);
  const query = () => {
    setTable((t) => (t + 1) % theme.words.length);
    queriedAt.current = performance.now() / 1000;
    sfx.click();
  };
  useDemoAction(`Query the ${name} database`, query);
  useFrame(() => {
    const age = performance.now() / 1000 - queriedAt.current;
    rows.current.forEach((m, i) => {
      const lit = age < 2 && (i * 7 + table) % 3 === 0 && age > i * 0.06;
      m.emissiveIntensity = lit ? 2 : 0.15;
    });
  });
  return (
    <group position={C} onClick={(e) => clicked(e) && query()} {...pointer}>
      <Plinth accent={accent} />
      {theme.words.map((t, i) => (
        <group key={t} position={[(i - (theme.words.length - 1) / 2) * 1.1, 0.42, 0]}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, 0.3 + k * 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.42, 0.42, 0.42, 32]} />
              {solid(i === table ? accent : theme.second === "#ffffff" ? "#cbd5e1" : theme.second, { metalness: 0.3 })}
            </mesh>
          ))}
          <Text position={[0, 1.85, 0]} fontSize={0.17} color="#ffffff" anchorX="center">
            {t}
          </Text>
        </group>
      ))}
      {/* Result rows floating behind */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0, 2.3 + i * 0.16, -0.6]}>
          <boxGeometry args={[2.6, 0.1, 0.02]} />
          <meshStandardMaterial ref={(m) => void (m && (rows.current[i] = m))} color="#0b1020" emissive={accent} emissiveIntensity={0.15} toneMapped={false} />
        </mesh>
      ))}
      <Text position={[0, 3.75, -0.6]} fontSize={0.16} color="#ffffff" anchorX="center">
        {`SELECT * FROM ${theme.words[table]} …`}
      </Text>
    </group>
  );
}

// --- Docker: containers that stack up --------------------------------------------------------

const CONTAINER_COLORS = ["#2496ed", "#f97316", "#22c55e", "#e11d48", "#a855f7"];

function ContainerStack({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const [count, setCount] = useState(2);
  const add = () => {
    setCount((c) => (c >= theme.words.length ? 1 : c + 1));
    sfx.clunk();
  };
  useDemoAction(`Start a ${name} container`, add);
  return (
    <group position={C} onClick={(e) => clicked(e) && add()} {...pointer}>
      <Plinth accent={accent} />
      {theme.words.slice(0, count).map((svc, i) => (
        <group key={svc} position={[(i % 2) * 0.3 - 0.15, 0.7 + i * 0.62, 0]}>
          <mesh castShadow>
            <boxGeometry args={[2.2, 0.6, 0.9]} />
            {solid(CONTAINER_COLORS[i % CONTAINER_COLORS.length], { roughness: 0.6 })}
          </mesh>
          {Array.from({ length: 9 }, (_, k) => (
            <mesh key={k} position={[-1 + k * 0.25, 0, 0.46]}>
              <boxGeometry args={[0.05, 0.52, 0.02]} />
              {solid("#00000033")}
            </mesh>
          ))}
          <Text position={[0, 0, 0.48]} fontSize={0.2} color="#ffffff" anchorX="center" anchorY="middle">
            {svc}
          </Text>
        </group>
      ))}
    </group>
  );
}

// --- Git: a branch graph that takes commits --------------------------------------------------

function BranchGraph({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const [commits, setCommits] = useState(4);
  const commit = () => {
    setCommits((c) => (c >= 9 ? 3 : c + 1));
    sfx.pop();
    burst(C, 2, [accent, "#ffffff"], 10);
  };
  useDemoAction(`Commit to ${name}`, commit);
  const lanes = theme.words.length;
  return (
    <group position={C} onClick={(e) => clicked(e) && commit()} {...pointer}>
      <Plinth accent={accent} />
      {theme.words.map((branch, lane) => (
        <group key={branch} position={[0, 1 + lane * 0.8, 0]}>
          <mesh rotation-z={Math.PI / 2} position={[0, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 3.4, 6]} />
            <meshStandardMaterial color={lane === 0 ? accent : theme.second} />
          </mesh>
          {Array.from({ length: commits }, (_, k) =>
            (k + lane) % lanes === 0 || lane === 0 ? (
              <mesh key={k} position={[-1.6 + (k / 8) * 3.2, 0, 0]}>
                <sphereGeometry args={[0.13, 16, 12]} />
                <meshStandardMaterial color={lane === 0 ? accent : theme.second} emissive={k === commits - 1 ? "#ffffff" : "#000000"} emissiveIntensity={0.6} />
              </mesh>
            ) : null,
          )}
          <Text position={[-1.9, 0, 0]} fontSize={0.15} color="#ffffff" anchorX="right" anchorY="middle">
            {branch}
          </Text>
        </group>
      ))}
      <Text position={[0, 1 + lanes * 0.8 + 0.2, 0]} fontSize={0.16} color="#ffffff" anchorX="center">
        {`${commits} commits · click to commit`}
      </Text>
    </group>
  );
}

// --- Jira: a kanban board whose cards move on ------------------------------------------------

function Kanban({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const [cards, setCards] = useState([0, 0, 1, 2]);
  const advance = () => {
    setCards((cs) => {
      const i = cs.findIndex((c) => c < theme.words.length - 1);
      if (i < 0) return [0, 0, 1, 2];
      const next = [...cs];
      next[i]++;
      return next;
    });
    sfx.click();
  };
  useDemoAction(`Move a ${name} ticket`, advance);
  const cols = theme.words.length;
  return (
    <group position={C} onClick={(e) => clicked(e) && advance()} {...pointer}>
      <Plinth accent={accent} />
      <mesh position={[0, 2, -0.1]} castShadow>
        <boxGeometry args={[3.8, 2.6, 0.08]} />
        {solid("#f4f5f7")}
      </mesh>
      {theme.words.map((col, i) => (
        <Text key={col} position={[-1.9 + (i + 0.5) * (3.8 / cols), 3.1, -0.04]} fontSize={0.13} color="#172b4d" anchorX="center">
          {col}
        </Text>
      ))}
      {cards.map((c, k) => (
        <group key={k} position={[-1.9 + (c + 0.5) * (3.8 / cols), 2.75 - (k % 3) * 0.5 - Math.floor(k / 3) * 0.1, -0.02]}>
          <mesh>
            <boxGeometry args={[0.8, 0.38, 0.03]} />
            {solid(c === cols - 1 ? "#36b37e" : "#ffffff")}
          </mesh>
          <Text position={[0, 0, 0.02]} fontSize={0.08} color="#172b4d" anchorX="center" anchorY="middle" maxWidth={0.72}>
            {`CITY-${101 + k}`}
          </Text>
        </group>
      ))}
      <mesh position={[0, 3.35, -0.05]}>
        <boxGeometry args={[3.8, 0.08, 0.04]} />
        <meshStandardMaterial color={accent} />
      </mesh>
    </group>
  );
}

// --- Redux / Zustand: actions fly into the store ---------------------------------------------

function StoreOrb({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const orb = useRef<THREE.Mesh>(null);
  const action = useRef<THREE.Group>(null);
  const firedAt = useRef(-10);
  const [state, setState] = useState(0);
  const [act, setAct] = useState(0);
  const dispatch = () => {
    firedAt.current = performance.now() / 1000;
    setAct((a) => (a + 1) % theme.words.length);
    window.setTimeout(() => setState((s) => s + 1), 700);
    sfx.click();
  };
  useDemoAction(`Dispatch to the ${name} store`, dispatch);
  useFrame(() => {
    const t = performance.now() / 1000;
    const age = t - firedAt.current;
    if (action.current) {
      action.current.visible = age < 0.7;
      const k = Math.min(1, age / 0.7);
      action.current.position.set(-1.8 * (1 - k), 1.8 + Math.sin(k * Math.PI) * 0.6, 0);
    }
    if (orb.current) {
      const pulse = age > 0.7 && age < 1.2 ? 1 + Math.sin(((age - 0.7) / 0.5) * Math.PI) * 0.25 : 1;
      orb.current.scale.setScalar(pulse);
      orb.current.rotation.y = t * 0.4;
    }
  });
  return (
    <group position={C} onClick={(e) => clicked(e) && dispatch()} {...pointer}>
      <Plinth accent={accent} />
      <mesh ref={orb} position={[0, 1.8, 0]} castShadow>
        <icosahedronGeometry args={[0.7, 2]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} roughness={0.2} metalness={0.3} />
      </mesh>
      <group ref={action} visible={false}>
        <mesh>
          <boxGeometry args={[0.9, 0.3, 0.1]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <Text position={[0, 0, 0.06]} fontSize={0.1} color="#1a103d" anchorX="center" anchorY="middle">
          {theme.words[act]}
        </Text>
      </group>
      <Text position={[0, 2.9, 0]} fontSize={0.18} color="#ffffff" anchorX="center">
        {`state.version = ${state}`}
      </Text>
    </group>
  );
}

// --- Hosting: deploy and watch it go up to the cloud -----------------------------------------

function DeployCloud({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const rocket = useRef<THREE.Group>(null);
  const deployedAt = useRef(-10);
  const [status, setStatus] = useState("ready");
  const deploy = () => {
    deployedAt.current = performance.now() / 1000;
    setStatus("deploying…");
    window.setTimeout(() => setStatus("live ✓"), 1600);
    sfx.sparkle();
  };
  useDemoAction(`Deploy with ${name}`, deploy);
  useFrame(() => {
    const age = performance.now() / 1000 - deployedAt.current;
    if (rocket.current) {
      const k = Math.min(1, Math.max(0, age / 1.5));
      rocket.current.position.y = 0.9 + k * 2.4;
      rocket.current.visible = age < 1.6 || age > 3;
      if (age > 3) rocket.current.position.y = 0.9;
    }
  });
  return (
    <group position={C} onClick={(e) => clicked(e) && deploy()} {...pointer}>
      <Plinth accent={accent} />
      {[-0.7, 0, 0.7].map((x, i) => (
        <mesh key={x} position={[x, 3.6 + (i % 2) * 0.15, 0]} castShadow>
          <sphereGeometry args={[0.55 - (i % 2) * 0.1, 20, 14]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.9} />
        </mesh>
      ))}
      <group ref={rocket} position={[0, 0.9, 0]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.16, 0.6, 16]} />
          {solid("#f8fafc")}
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <coneGeometry args={[0.12, 0.25, 16]} />
          {solid(accent)}
        </mesh>
      </group>
      {theme.words.map((svc, i) => (
        <Text key={svc} position={[-1.2 + i * 1.2, 0.75, 1.2]} fontSize={0.15} color="#ffffff" anchorX="center">
          {svc}
        </Text>
      ))}
      <Text position={[0, 2.2, 1]} fontSize={0.2} color={status.startsWith("live") ? "#22c55e" : "#ffffff"} anchorX="center">
        {`status: ${status}`}
      </Text>
    </group>
  );
}

// --- Figma / UI/UX: frames that take the swatch you pick -------------------------------------

function DesignFrames({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const [pick, setPick] = useState(0);
  const recolor = () => {
    setPick((p) => (p + 1) % theme.words.length);
    sfx.sparkle();
  };
  useDemoAction(`Apply a ${name} color`, recolor);
  const color = theme.words[pick];
  return (
    <group position={C} onClick={(e) => clicked(e) && recolor()} {...pointer}>
      <Plinth accent={accent} />
      {[
        [-1, 2, 1.1, 1.8],
        [0.4, 2.2, 1.4, 1],
        [0.4, 1.4, 1.4, 0.5],
      ].map(([x, y, w, h], i) => (
        <group key={i} position={[x, y, 0]}>
          <mesh>
            <boxGeometry args={[w, h, 0.04]} />
            {solid("#ffffff")}
          </mesh>
          <mesh position={[0, h / 2 - 0.12, 0.03]}>
            <boxGeometry args={[w - 0.12, 0.12, 0.01]} />
            {solid(color)}
          </mesh>
          <mesh position={[0, -h / 4, 0.03]}>
            <boxGeometry args={[w * 0.5, 0.12, 0.01]} />
            {solid(color)}
          </mesh>
        </group>
      ))}
      {theme.words.map((c, i) => (
        <mesh key={c} position={[-1.2 + i * 0.6, 0.7, 1.1]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.08 + (i === pick ? 0.2 : 0), 24]} />
          {solid(c)}
        </mesh>
      ))}
    </group>
  );
}

// --- n8n / AI: a workflow whose signal runs node to node -------------------------------------

function Workflow({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const lights = useRef<THREE.MeshStandardMaterial[]>([]);
  const runAt = useRef(-10);
  const run = () => {
    runAt.current = performance.now() / 1000;
    sfx.click();
  };
  useDemoAction(`Run the ${name} workflow`, run);
  useFrame(() => {
    const age = performance.now() / 1000 - runAt.current;
    lights.current.forEach((m, i) => {
      m.emissiveIntensity = age > i * 0.45 && age < i * 0.45 + 0.6 ? 2.4 : 0.3;
    });
  });
  const n = theme.words.length;
  return (
    <group position={C} onClick={(e) => clicked(e) && run()} {...pointer}>
      <Plinth accent={accent} />
      {theme.words.map((node, i) => {
        const x = -1.8 + (i / (n - 1)) * 3.6;
        const y = 1.6 + (i % 2) * 0.6;
        return (
          <group key={node} position={[x, y, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.8, 0.6, 0.2]} />
              <meshStandardMaterial ref={(m) => void (m && (lights.current[i] = m))} color="#ffffff" emissive={accent} emissiveIntensity={0.3} />
            </mesh>
            <Text position={[0, -0.5, 0]} fontSize={0.12} color="#ffffff" anchorX="center">
              {node}
            </Text>
            {i < n - 1 && (
              <mesh position={[(3.6 / (n - 1)) / 2, (i % 2 ? -0.3 : 0.3), 0]} rotation-z={(i % 2 ? 1 : -1) * Math.atan2(0.6, 3.6 / (n - 1)) + Math.PI / 2}>
                <cylinderGeometry args={[0.02, 0.02, Math.hypot(3.6 / (n - 1), 0.6) - 0.6, 6]} />
                <meshStandardMaterial color={accent} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// --- Architecture: layers with a request path that lights up ---------------------------------

function LayerStack({ theme, accent, name }: DemoProps) {
  const C = useCenter();
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const at = useRef(-10);
  const trace = () => {
    at.current = performance.now() / 1000;
    sfx.click();
  };
  useDemoAction(`Trace a request through ${name}`, trace);
  useFrame(() => {
    const age = performance.now() / 1000 - at.current;
    mats.current.forEach((m, i) => {
      m.emissiveIntensity = age > i * 0.35 && age < i * 0.35 + 0.5 ? 2 : 0.2;
    });
  });
  const n = theme.words.length;
  return (
    <group position={C} onClick={(e) => clicked(e) && trace()} {...pointer}>
      <Plinth accent={accent} />
      {theme.words.map((layer, i) => (
        <group key={layer} position={[0, 3.6 - i * (2.8 / n), 0]}>
          <mesh castShadow>
            <boxGeometry args={[2.6 - i * 0.15, 0.36, 1.2]} />
            <meshStandardMaterial ref={(m) => void (m && (mats.current[i] = m))} color={i % 2 ? theme.backdrop : "#e2e8f0"} emissive={accent} emissiveIntensity={0.2} transparent opacity={0.92} />
          </mesh>
          <Text position={[0, 0, 0.61]} fontSize={0.15} color={i % 2 ? "#ffffff" : "#1a103d"} anchorX="center" anchorY="middle">
            {layer}
          </Text>
        </group>
      ))}
    </group>
  );
}
