import { createServer } from "node:http";
import os from "node:os";
import next from "next";
import { Server } from "socket.io";
import { Room } from "./src/server/room";

const port = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== "production";

/** The PC's Wi-Fi / LAN addresses that phones can use, best guesses first. */
function lanUrls(): string[] {
  const rank = (ip: string) => (ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : ip.startsWith("172.") ? 2 : 3);
  const skip = /vethernet|virtualbox|vmware|wsl|docker|hyper-v|loopback|tailscale|zerotier/i;
  const ips: string[] = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (skip.test(name)) continue;
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) ips.push(a.address);
    }
  }
  return [...new Set(ips)].sort((a, b) => rank(a) - rank(b)).map((ip) => `http://${ip}:${port}`);
}

const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  // Compression shrinks the 30-per-second game updates ~4x, which matters
  // when 16 phones share one Wi-Fi router or a phone hotspot.
  const io = new Server(httpServer, {
    pingInterval: 5000,
    pingTimeout: 8000,
    perMessageDeflate: { threshold: 512 },
  });
  const urls = lanUrls();
  const room = new Room(io, urls);
  io.on("connection", (socket) => room.attach(socket));

  httpServer.listen(port, "0.0.0.0", () => {
    const line = "=".repeat(52);
    console.log(`\n${line}\n  STICK PARTY is running  (${dev ? "dev" : "production"} mode)\n${line}`);
    console.log(`  On this PC:      http://localhost:${port}`);
    if (urls.length) {
      console.log(`  On phones (same Wi-Fi / hotspot):`);
      for (const u of urls) console.log(`     ${u}`);
    } else {
      console.log("  No network found. Connect this PC to Wi-Fi or a hotspot.");
    }
    console.log(`${line}\n`);
  });
});
