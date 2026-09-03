import { execSync, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.EXPO_PORT || "8081";
const requestedHost = process.env.EXPO_HOST === "tunnel" ? "tunnel" : "lan";

function pidsOnPort(nextPort) {
  try {
    return execSync(`lsof -nP -iTCP:${nextPort} -sTCP:LISTEN -t`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .map((value) => Number(value))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function lanIPv4() {
  const preferred = [];
  const rest = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      const family = String(addr.family);
      if (family !== "IPv4" && family !== "4") continue;
      if (addr.internal) continue;
      if (
        addr.address.startsWith("192.168.") ||
        addr.address.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(addr.address)
      ) {
        preferred.push(addr.address);
      } else {
        rest.push(addr.address);
      }
    }
  }
  return preferred[0] || rest[0] || null;
}

function adbReverse() {
  const adb =
    process.env.ADB_PATH ||
    `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
  try {
    const listing = execSync(`"${adb}" devices`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const connected = listing
      .split("\n")
      .slice(1)
      .some((line) => line.includes("\tdevice"));
    if (!connected) return false;
    execSync(`"${adb}" reverse tcp:8081 tcp:8081`, { stdio: "ignore" });
    execSync(`"${adb}" reverse tcp:8787 tcp:8787`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function freePort() {
  for (const pid of pidsOnPort(port)) {
    if (pid === process.pid) continue;
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process already gone.
    }
  }
}

function startExpo(hostMode) {
  const env = { ...process.env };
  delete env.CI;
  if (lanIp) {
    env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
    env.EXPO_PUBLIC_API_URL = `http://${lanIp}:8787`;
  }

  const expoArgs = ["expo", "start", "--port", port];
  if (hostMode === "tunnel") {
    expoArgs.push("--tunnel");
    console.log(
      "Expo host: tunnel. If ngrok fails, this script will fall back to LAN.",
    );
  } else {
    expoArgs.push("--lan");
    console.log("Expo host: LAN. Close Expo Go fully, then scan the new QR.");
  }

  return spawn("npx", expoArgs, {
    cwd: mobileDir,
    env,
    stdio: "inherit",
  });
}

freePort();

const lanIp = lanIPv4();
if (adbReverse()) {
  console.log("ADB reverse is set for 8081 and 8787.");
}
if (lanIp) {
  console.log(`Phone API: http://${lanIp}:8787`);
}

let child = startExpo(requestedHost);
let fallingBack = false;

child.on("exit", (code, signal) => {
  if (signal === "SIGINT" || signal === "SIGTERM") {
    process.exit(1);
    return;
  }
  if (requestedHost === "tunnel" && !fallingBack && code && code !== 0) {
    fallingBack = true;
    console.log(
      "\nExpo tunnel (ngrok) failed. Starting on LAN instead. Keep the phone on the same Wi‑Fi as this Mac.\n",
    );
    freePort();
    child = startExpo("lan");
    child.on("exit", (nextCode, nextSignal) => {
      process.exit(nextSignal ? 1 : (nextCode ?? 0));
    });
    return;
  }
  process.exit(signal ? 1 : (code ?? 0));
});
