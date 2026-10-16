// Makes the values for the /admin sign-in: run `npm run admin:password`, type the password you want
// (it isn't shown or saved), then copy the printed lines into .env and Vercel's environment variables.
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
// Hide what's typed: only the prompts and line breaks reach the screen.
let prompt = "";
rl._writeToOutput = (s) => {
  if (s === prompt || s.includes("\n")) process.stdout.write(s === prompt ? s : "\n");
};
const lines = rl[Symbol.asyncIterator]();
const ask = async (q) => {
  prompt = q;
  process.stdout.write(q);
  const { value } = await lines.next();
  return value ?? "";
};

const password = await ask("Password for /admin (at least 12 characters): ");
const again = await ask("Type it again: ");
rl.close();
console.log();
if (password !== again) {
  console.error("The two passwords don't match. Nothing was made.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("Use at least 12 characters. Nothing was made.");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32);
console.log("\nAdd these lines to .env and to Vercel (Settings → Environment Variables):\n");
console.log(`ADMIN_PASSWORD_HASH=scrypt:${salt.toString("base64url")}:${hash.toString("base64url")}`);
if (!process.argv.includes("--hash-only")) console.log(`AUTH_SECRET=${randomBytes(32).toString("base64url")}`);
console.log("\n(Keep AUTH_SECRET the same once it's set; a new one signs you out.)");
