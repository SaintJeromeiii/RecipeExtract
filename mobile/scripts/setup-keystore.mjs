import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const credDir = path.join(mobileDir, "credentials/android");
const keystorePath = path.join(credDir, "keystore.jks");
const credFile = path.join(mobileDir, "credentials.json");

if (fs.existsSync(keystorePath) && fs.existsSync(credFile)) {
  console.log(`Keystore already exists:\n  ${keystorePath}\n  ${credFile}`);
  console.log("Leave these files on this Mac (and a backup). Do not commit them.");
  process.exit(0);
}

fs.mkdirSync(credDir, { recursive: true });
const password = crypto.randomBytes(24).toString("base64url");
const alias = "recipeguru";

execSync(
  [
    "keytool -genkeypair -v",
    `-keystore "${keystorePath}"`,
    `-alias ${alias}`,
    "-keyalg RSA -keysize 2048 -validity 10000",
    `-storepass "${password}"`,
    `-keypass "${password}"`,
    '-dname "CN=RecipeGuru, O=RecipeGuru, C=US"',
    "-storetype PKCS12",
  ].join(" "),
  { stdio: "inherit" },
);

fs.writeFileSync(
  credFile,
  `${JSON.stringify(
    {
      android: {
        keystore: {
          keystorePath: "credentials/android/keystore.jks",
          keystorePassword: password,
          keyAlias: alias,
          keyPassword: password,
        },
      },
    },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);
fs.chmodSync(keystorePath, 0o600);

console.log(`\nCreated release keystore:`);
console.log(`  ${keystorePath}`);
console.log(`  ${credFile}`);
console.log("Back these two files up somewhere safe. If you lose them, later APKs cannot update the installed app.");
console.log("They are gitignored. After the first signed install, updates are: npm run apk && npm run apk:install");
