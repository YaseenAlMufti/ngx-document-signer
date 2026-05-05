# Document Signer

Angular workspace for `ngx-document-signer`, a reusable package that provides a PDF form creator and PDF signer.

## Build

```bash
npm install
npm run build
```

The library builds into `dist/ngx-document-signer`.

## Package API

Import the standalone components from `ngx-document-signer`:

```ts
import { PdfCreatorComponent, PdfSignerComponent } from 'ngx-document-signer';
```

Creator:

```html
<nds-pdf-creator (saved)="uploadCreatedPdf($event.bytes)"></nds-pdf-creator>
```

Signer:

```html
<nds-pdf-signer [source]="createdPdfUrlOrBytes" (completed)="uploadSignedPdf($event.bytes)"></nds-pdf-signer>
```

`source` accepts an href, `Blob`, `ArrayBuffer`, or `Uint8Array`.

## Angular release lines

This package is intended to publish two npm major lines from the same source:

- `ngx-document-signer@1.x` for Angular 14, 15, and 16.
- `ngx-document-signer@2.x` for Angular 17+.

Use `npm run profile:ng14` or `npm run profile:ng17` before installing dependencies and building a release. See `docs/angular-versioning.md` for the full workflow.

## License and support

This project is released under the MIT License. Packages and redistributed copies must keep the copyright and license notice, which gives credit to Yaseen Al Mufti.

Donation link: https://github.com/sponsors/yaseenalmufti
