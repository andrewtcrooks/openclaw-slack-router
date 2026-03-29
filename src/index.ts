import "dotenv/config";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const app = createApp(config);
  await app.start();
  console.log("Rook is running in Socket Mode");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
