import { spawnSync } from "node:child_process";

const profileName = process.argv[2];
const shouldPublish = process.argv.includes("--publish");
const skipInstall = process.argv.includes("--skip-install");
const otp = process.argv.find((arg) => arg.startsWith("--otp="));

const profiles = {
  "angular-14-16": {
    tag: "legacy",
  },
  "angular-17-plus": {
    tag: "latest",
  },
};

if (!profileName || !profiles[profileName]) {
  console.error("Usage: node scripts/release-package.mjs angular-14-16|angular-17-plus [--publish] [--skip-install]");
  process.exit(1);
}

const commands = [
  ["node", ["scripts/apply-release-profile.mjs", profileName]],
];

if (!skipInstall) {
  commands.push(["npm", ["install", "--legacy-peer-deps"]]);
}

commands.push(
  ["node", ["./node_modules/ng-packagr/cli/main.js", "-p", "projects/ngx-document-signer/ng-package.json"]],
  ["npm", ["pack", "./dist/ngx-document-signer", "--dry-run"]],
);

if (shouldPublish) {
  const publishArgs = ["publish", "./dist/ngx-document-signer", "--tag", profiles[profileName].tag, "--access", "public"];
  if (otp) {
    publishArgs.push(otp);
  }
  commands.push(["npm", publishArgs]);
}

for (const [command, args] of commands) {
  console.log("\n$ " + [command, ...args].join(" "));
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
