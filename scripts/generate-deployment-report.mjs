import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const pages = ["dashboard", "tasks", "kanban", "upload", "analytics", "debug"];
const warnings = [];

const envFromProcess = requiredEnv.every((key) => Boolean(process.env[key]));
const envLocalPath = path.join(root, ".env.local");
let envFromFile = false;

if (fs.existsSync(envLocalPath)) {
  const envLocal = fs.readFileSync(envLocalPath, "utf8");
  envFromFile = requiredEnv.every((key) => new RegExp(`^${key}=.+`, "m").test(envLocal));
}

const env = envFromProcess || envFromFile;
if (!env) warnings.push("缺少 Supabase 环境变量，请检查 .env.local 或 Vercel Environment Variables。");

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "outputs", "work"].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) sourceFiles.push(fullPath);
  }
}
walk(root);

const consoleLogFiles = sourceFiles.filter((file) => fs.readFileSync(file, "utf8").includes("console.log"));
if (consoleLogFiles.length) warnings.push(`发现 console.log：${consoleLogFiles.map((file) => path.relative(root, file)).join(", ")}`);

const mockFiles = sourceFiles.filter((file) => /mock data|mockData|MOCK_DATA/i.test(fs.readFileSync(file, "utf8")));
if (mockFiles.length) warnings.push(`发现疑似 mock data：${mockFiles.map((file) => path.relative(root, file)).join(", ")}`);

const pageStatus = Object.fromEntries(
  pages.map((page) => [page, fs.existsSync(path.join(root, "app", page, "page.tsx")) || fs.existsSync(path.join(root, "app", "(app)", page, "page.tsx"))])
);

const report = {
  status: env && Object.values(pageStatus).every(Boolean) && warnings.length === 0 ? "ready" : "not_ready",
  env,
  db: false,
  auth: false,
  storage: false,
  pages: pageStatus,
  warnings,
  timestamp: new Date().toISOString(),
};

fs.writeFileSync(path.join(root, "deployment-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.warn(`deployment-report.json generated with status: ${report.status}`);
