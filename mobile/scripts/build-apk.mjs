import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(mobileDir, "android");
const distDir = path.join(mobileDir, "dist");
const apkDest = path.join(distDir, "RecipeGuru.apk");
const aabDest = path.join(distDir, "RecipeGuru.aab");
const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://recipeextract-production.up.railway.app";
const wantInstall = process.argv.includes("--install");
const wantAab = process.argv.includes("--aab");
const sdkHome =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(os.homedir(), "Library/Android/sdk");

function javaHome() {
  try {
    return execSync("/usr/libexec/java_home -v 17", { encoding: "utf8" }).trim();
  } catch {
    return process.env.JAVA_HOME || "";
  }
}

function run(command, args, cwd = mobileDir) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL: apiUrl,
      ANDROID_HOME: sdkHome,
      ANDROID_SDK_ROOT: sdkHome,
      JAVA_HOME: javaHome() || process.env.JAVA_HOME,
    },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readCredentials() {
  const file = path.join(mobileDir, "credentials.json");
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return parsed.android?.keystore ?? parsed.keystore ?? null;
}

function applyReleaseSigning() {
  const keystore = readCredentials();
  const gradlePath = path.join(androidDir, "gradle.properties");
  if (!fs.existsSync(gradlePath)) return false;
  let gradle = fs.readFileSync(gradlePath, "utf8");
  gradle = gradle
    .split("\n")
    .filter((line) => !line.startsWith("MYAPP_UPLOAD_"))
    .join("\n")
    .trimEnd();

  if (!keystore) {
    fs.writeFileSync(gradlePath, gradle.endsWith("\n") ? gradle : `${gradle}\n`);
    console.log(
      "No credentials.json found. Run: npm run keystore --prefix mobile",
    );
    return false;
  }

  const storeFile = keystore.keystorePath
    ? path.basename(keystore.keystorePath)
    : "keystore.jks";
  const source = keystore.keystorePath
    ? path.resolve(mobileDir, keystore.keystorePath)
    : path.join(mobileDir, storeFile);
  if (!fs.existsSync(source)) {
    throw new Error(`Keystore file not found: ${source}`);
  }
  fs.copyFileSync(source, path.join(androidDir, "app", storeFile));
  gradle += `

MYAPP_UPLOAD_STORE_FILE=${storeFile}
MYAPP_UPLOAD_KEY_ALIAS=${keystore.keyAlias}
MYAPP_UPLOAD_STORE_PASSWORD=${keystore.keystorePassword}
MYAPP_UPLOAD_KEY_PASSWORD=${keystore.keyPassword}
`;
  fs.writeFileSync(gradlePath, `${gradle.trimEnd()}\n`);
  patchAppBuildGradle();
  console.log("Signing with the RecipeGuru release keystore.");
  return true;
}

function patchAppBuildGradle() {
  const file = path.join(androidDir, "app/build.gradle");
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, "utf8");
  if (text.includes("MYAPP_UPLOAD_STORE_FILE")) return;
  text = text.replace(
    `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`,
    `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            def storeFileName = findProperty('MYAPP_UPLOAD_STORE_FILE')
            if (storeFileName) {
                storeFile file(storeFileName)
                storePassword findProperty('MYAPP_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('MYAPP_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('MYAPP_UPLOAD_KEY_PASSWORD')
            }
        }
    }`,
  );
  text = text.replace(
    `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`,
    `        release {
            signingConfig signingConfigs.debug
            if (signingConfigs.release.storeFile) {
                signingConfig signingConfigs.release
            }`,
  );
  fs.writeFileSync(file, text);
}

function connectedSerials(adb) {
  const listing = execSync(`"${adb}" devices`, { encoding: "utf8" });
  return listing
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.endsWith("\tdevice") || /\sdevice\s/.test(line) || /\sdevice$/.test(line))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}

if (!fs.existsSync(path.join(sdkHome, "platform-tools"))) {
  console.error(`Android SDK not found at ${sdkHome}. Open Android Studio once and install the SDK.`);
  process.exit(1);
}

console.log(wantAab ? "RecipeGuru Play Store AAB" : "RecipeGuru local APK");
console.log(`API: ${apiUrl}`);
run("npx", ["expo", "prebuild", "--platform", "android", "--non-interactive"]);
applyReleaseSigning();
run(
  path.join(androidDir, "gradlew"),
  [wantAab ? ":app:bundleRelease" : ":app:assembleRelease", "--quiet"],
  androidDir,
);

const built = wantAab
  ? path.join(androidDir, "app/build/outputs/bundle/release/app-release.aab")
  : path.join(androidDir, "app/build/outputs/apk/release/app-release.apk");
const dest = wantAab ? aabDest : apkDest;
if (!fs.existsSync(built)) {
  console.error(`Gradle finished but no package at ${built}`);
  process.exit(1);
}
fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(built, dest);
console.log(`\n${wantAab ? "AAB" : "APK"} ready: ${dest}`);

if (wantAab) {
  process.exit(0);
}

if (wantInstall) {
  const adb = path.join(sdkHome, "platform-tools/adb");
  const serials = connectedSerials(adb);
  if (!serials.length) {
    console.log("No phones in USB debugging mode. Plug one in, or copy the APK over.");
    process.exit(0);
  }
  for (const serial of serials) {
    console.log(`Installing on ${serial}…`);
    const result = spawnSync(adb, ["-s", serial, "install", "-r", apkDest], {
      stdio: "inherit",
    });
    if (result.status !== 0) {
      console.log(
        `Could not replace the existing app on ${serial} (different signature). Uninstall RecipeGuru once on that phone, then run: npm run apk:install`,
      );
    }
  }
}
