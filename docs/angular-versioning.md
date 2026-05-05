# Angular Versioning

This repository supports two npm release lines for the same package name, `ngx-document-signer`.

| Consumer Angular version | npm version line | Build profile |
| --- | --- | --- |
| Angular 14, 15, 16 | `ngx-document-signer@1.x` | `angular-14-16` |
| Angular 17+ | `ngx-document-signer@2.x` | `angular-17-plus` |

Use separate git branches or git worktrees for publishing each line. Angular partial-compiled libraries should be built with the lowest Angular compiler major they claim to support.

## Legacy Angular 14-16 Release

1. Create or switch to a legacy release branch, for example `release/1.x-angular14`.
2. Run `npm run profile:ng14`.
3. Run `npm install` to install Angular 14, ng-packagr 14, and TypeScript 4.8 tooling.
4. Run `npm run build`.
5. Publish `dist/ngx-document-signer` as `ngx-document-signer@1.x`.

Consumers install it with:

```bash
npm install ngx-document-signer@^1
```

## Modern Angular 17+ Release

1. Create or switch to the modern release branch, for example `main` or `release/2.x-angular17`.
2. Run `npm run profile:ng17`.
3. Run `npm install` to install Angular 17, ng-packagr 17, and TypeScript 5.4 tooling.
4. Run `npm run build`.
5. Publish `dist/ngx-document-signer` as `ngx-document-signer@2.x`.

Consumers install it with:

```bash
npm install ngx-document-signer@^2
```

## Notes

The source avoids Angular APIs newer than Angular 14 so the library code can stay shared. The release profile changes only the Angular build toolchain, package version, and peer dependency range.

If a consuming app has a custom PDF.js worker setup, pass `[workerSrc]` to `nds-pdf-creator` or `nds-pdf-signer`.
