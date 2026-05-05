import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const profileName = process.argv[2];

if (!profileName) {
  console.error("Usage: npm run profile:ng14|profile:ng17");
  process.exit(1);
}

const root = process.cwd();
const profilePath = resolve(root, "release-profiles", profileName + ".json");
const profile = JSON.parse(readFileSync(profilePath, "utf8"));

function applyPackagePatch(filePath, patch) {
  const absolutePath = resolve(root, filePath);
  const packageJson = JSON.parse(readFileSync(absolutePath, "utf8"));
  const nextPackageJson = {
    ...packageJson,
    ...patch,
    dependencies: patch.dependencies ?? packageJson.dependencies,
    devDependencies: patch.devDependencies ?? packageJson.devDependencies,
    peerDependencies: patch.peerDependencies ?? packageJson.peerDependencies,
  };

  writeFileSync(absolutePath, JSON.stringify(nextPackageJson, null, 2) + "\n");
}

function applyTsconfigPatch(filePath, patch) {
  if (!patch) {
    return;
  }

  const absolutePath = resolve(root, filePath);
  let content = readFileSync(absolutePath, "utf8");

  for (const [key, value] of Object.entries(patch.compilerOptions ?? {})) {
    const pattern = new RegExp('"' + key + '"\\s*:\\s*"[^"]+"');
    content = content.replace(pattern, '"' + key + '": "' + value + '"');
  }

  writeFileSync(absolutePath, content);
}

applyPackagePatch("package.json", profile.rootPackage);
applyPackagePatch("projects/ngx-document-signer/package.json", profile.libraryPackage);
applyTsconfigPatch("tsconfig.json", profile.tsconfig);

console.log("Applied " + profileName + " release profile.");
console.log(profile.note);
