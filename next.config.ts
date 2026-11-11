import type { NextConfig } from "next";
import os from "node:os";

// Phones reach the dev server through the PC's LAN IP, so allow those
// origins in dev mode (production mode doesn't need this).
const lanHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((a): a is os.NetworkInterfaceInfo => !!a && a.family === "IPv4" && !a.internal)
  .map((a) => a.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanHosts,
  devIndicators: false,
};

export default nextConfig;
