/**
 * The neighborhood shops and restaurants that fill out each district's ring. Food places
 * have a menu you can order from (the order is served at a table, sit down to eat it);
 * the other shops have something small to do at the counter.
 */

export type MenuItem = {
  name: string;
  price: string;
  /** How it's served in 3D */
  dish: "cup" | "glass" | "plate" | "bowl" | "wrap" | "pizza" | "cone";
  /** Main color of the food or drink */
  color: string;
  note?: string;
};

export type ShopInfo = {
  kind: "food" | "shop";
  /** What the counter is called in prompts ("Order at the counter", "Browse the shelves") */
  verb: string;
  menu?: MenuItem[];
  /** For non-food shops: lines the shopkeeper says when you browse */
  lines?: string[];
  /** Interior colors */
  wall: string;
  accent: string;
};

export const SHOPS: Record<string, ShopInfo> = {
  "Café Byte": {
    kind: "food",
    verb: "Order a coffee",
    wall: "#f2e6d8",
    accent: "#8b5a2b",
    menu: [
      { name: "Cardamom coffee", price: "LBP 90k", dish: "cup", color: "#4a2c1a", note: "Lebanese style, strong" },
      { name: "Flat white", price: "LBP 180k", dish: "cup", color: "#c9a27a" },
      { name: "Iced latte", price: "LBP 200k", dish: "glass", color: "#d8b892" },
      { name: "Croissant", price: "LBP 120k", dish: "plate", color: "#d99a3e" },
      { name: "Debugging brownie", price: "LBP 150k", dish: "plate", color: "#3b2416", note: "fixes nothing, helps anyway" },
    ],
  },
  "Corner Bakery": {
    kind: "food",
    verb: "Order at the oven",
    wall: "#f6ead3",
    accent: "#b45309",
    menu: [
      { name: "Zaatar manakish", price: "LBP 100k", dish: "plate", color: "#6b7d2a" },
      { name: "Cheese manakish", price: "LBP 150k", dish: "plate", color: "#f1d48a" },
      { name: "Lahm bi ajeen", price: "LBP 180k", dish: "plate", color: "#a5432a" },
      { name: "Kaak with zaatar", price: "LBP 80k", dish: "plate", color: "#c98a3e" },
      { name: "Ayran", price: "LBP 60k", dish: "glass", color: "#f4f4ef" },
    ],
  },
  "Tea House": {
    kind: "food",
    verb: "Order some tea",
    wall: "#e5efe8",
    accent: "#0f766e",
    menu: [
      { name: "Mint tea", price: "LBP 70k", dish: "glass", color: "#9cbf5a" },
      { name: "Sahlab", price: "LBP 140k", dish: "cup", color: "#f3ead8", note: "with cinnamon and pistachio" },
      { name: "Karak chai", price: "LBP 110k", dish: "cup", color: "#b98a5a" },
      { name: "Maamoul", price: "LBP 90k", dish: "plate", color: "#d9b07a" },
    ],
  },
  "Ice Cream": {
    kind: "food",
    verb: "Pick a flavor",
    wall: "#fbe7f3",
    accent: "#db2777",
    menu: [
      { name: "Ashta", price: "LBP 120k", dish: "cone", color: "#fbf6ea" },
      { name: "Pistachio", price: "LBP 130k", dish: "cone", color: "#a8c66c" },
      { name: "Mango sorbet", price: "LBP 120k", dish: "cone", color: "#f6b13c" },
      { name: "Rose & lychee", price: "LBP 140k", dish: "cone", color: "#f4a6c4" },
    ],
  },
  "Mezze House": {
    kind: "food",
    verb: "Order mezze",
    wall: "#f3e9dc",
    accent: "#15803d",
    menu: [
      { name: "Hummus", price: "LBP 250k", dish: "bowl", color: "#e8cf9a" },
      { name: "Tabbouleh", price: "LBP 280k", dish: "bowl", color: "#4f8a2a" },
      { name: "Fattoush", price: "LBP 280k", dish: "bowl", color: "#7aa846" },
      { name: "Falafel plate", price: "LBP 300k", dish: "plate", color: "#7a4a22" },
      { name: "Lemonade with mint", price: "LBP 150k", dish: "glass", color: "#d8e36a" },
    ],
  },
  "Shawarma Corner": {
    kind: "food",
    verb: "Order a sandwich",
    wall: "#f4e4d0",
    accent: "#c2410c",
    menu: [
      { name: "Chicken shawarma", price: "LBP 350k", dish: "wrap", color: "#e6c48a", note: "with toum and pickles" },
      { name: "Beef shawarma plate", price: "LBP 600k", dish: "plate", color: "#7a3a1e" },
      { name: "Fries", price: "LBP 150k", dish: "bowl", color: "#f2c14e" },
      { name: "Ayran", price: "LBP 60k", dish: "glass", color: "#f4f4ef" },
    ],
  },
  "Pizza & Code": {
    kind: "food",
    verb: "Order a pizza",
    wall: "#f6e7dc",
    accent: "#b91c1c",
    menu: [
      { name: "Margherita", price: "LBP 550k", dish: "pizza", color: "#d9442c" },
      { name: "Pepperoni", price: "LBP 650k", dish: "pizza", color: "#b4321f" },
      { name: "Zaatar & labneh pizza", price: "LBP 600k", dish: "pizza", color: "#6b7d2a" },
      { name: "Merge-conflict salad", price: "LBP 300k", dish: "bowl", color: "#5f9a3c", note: "accept both changes" },
    ],
  },
  Bookshop: { kind: "shop", verb: "Browse the shelves", wall: "#efe7da", accent: "#2c7a7b", lines: ["A first edition of The Pragmatic Programmer. Tempting.", "Poetry by Mahmoud Darwish, next to Clean Code. Perfect.", "The owner recommends Designing Data-Intensive Applications."] },
  "Co-working Hub": { kind: "shop", verb: "Grab a hot desk", wall: "#ece9f6", accent: "#6b46c1", lines: ["Wi-Fi: 500 Mbps. Password: shipitnotperfect.", "Desk 4 is free. The coffee is on the house.", "Someone is pair programming in the corner booth."] },
  "Flower Shop": { kind: "shop", verb: "Pick a bouquet", wall: "#f6eef8", accent: "#9f7aea", lines: ["A bouquet of lilacs, wrapped in kraft paper. 💐", "Jasmine from the mountains. It smells like summer in Tripoli.", "White roses and eucalyptus. Classic."] },
  "Art Supplies": { kind: "shop", verb: "Browse the paints", wall: "#f8eaf1", accent: "#d53f8c", lines: ["A new set of gouache in jewel tones.", "Canvas panels, 30 × 40, three for two.", "The shopkeeper says the easel in the Hobby Quarter is free to use."] },
  "Bike Repair": { kind: "shop", verb: "Ask for a tune-up", wall: "#ecebf2", accent: "#553c9a", lines: ["Chain oiled, brakes tightened. Good as new.", "\"Try the ring road at sunset,\" says the mechanic."] },
  Pharmacy: { kind: "shop", verb: "Ask the pharmacist", wall: "#e6f4f2", accent: "#14b8a6", lines: ["Vitamin D, because developers forget the sun.", "Eye drops for long nights in front of the screen."] },
  "Print Shop": { kind: "shop", verb: "Print a poster", wall: "#eeeaf6", accent: "#805ad5", lines: ["Printed: \"Perfection is the enemy of progress\", A2, matte.", "Stickers: a tiny </> for every laptop."] },
  Gym: { kind: "shop", verb: "Lift some weights", wall: "#e9e7ef", accent: "#4c1d95", lines: ["Three sets of ten. Strong like a well-tested API.", "Personal record! The playlist helped."] },
};

export const shopInfo = (label: string): ShopInfo =>
  SHOPS[label] ?? { kind: "shop", verb: "Look around", wall: "#efeaf4", accent: "#6b46c1", lines: ["A cozy little shop."] };
