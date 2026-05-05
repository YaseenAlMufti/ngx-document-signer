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

The creator can place text, date, and signature boxes. Date boxes are saved as PDF text fields with an `nds_date_` prefix so the signer can show a Today button.

Date boxes render as native `input type="date"` controls on the signer. They keep the browser's `YYYY-MM-DD` value internally, but the saved PDF defaults to US-style `MM/DD/YYYY`; generated date fields are borderless in the final PDF.

Signer:

```html
<nds-pdf-signer [source]="createdPdfUrlOrBytes" (completed)="uploadSignedPdf($event.bytes)"></nds-pdf-signer>
```

`source` accepts an href, `Blob`, `ArrayBuffer`, or `Uint8Array`.

Signer saves flatten the whole form by default. Set `[partialFlattenOnSave]="true"` to flatten only fields that have signer-provided values, leaving empty fields editable.

## Angular release lines

This package is intended to publish two npm major lines from the same source:

- `ngx-document-signer@1.x` for Angular 14, 15, and 16.
- `ngx-document-signer@2.x` for Angular 17+.

Use `npm run profile:ng14` or `npm run profile:ng17` before installing dependencies and building a release. See `docs/angular-versioning.md` for the full workflow.

## License and support

This project is released under the MIT License. Packages and redistributed copies must keep the copyright and license notice, which gives credit to Yaseen Al Mufti.

Donation link: https://github.com/sponsors/yaseenalmufti

## PDF.js worker

By default, `ngx-document-signer` loads the matching PDF.js worker from the unpkg CDN when you do not pass `workerSrc`:

```text
https://unpkg.com/pdfjs-dist@<pdfjs-version>/build/pdf.worker.min.mjs
```

This keeps the package working in Angular projects where bundlers do not rewrite PDF.js worker imports correctly, including older Angular builds. It does mean the browser may fetch the worker from a third-party CDN at runtime.

If your project has CSP restrictions, offline requirements, private-network requirements, compliance review, or a policy against third-party runtime assets, host the worker yourself and pass a browser-accessible URL:

```html
<nds-pdf-creator [workerSrc]="'assets/pdfjs/pdf.worker.min.mjs'"></nds-pdf-creator>

<nds-pdf-signer
  [source]="pdfSource"
  [workerSrc]="'assets/pdfjs/pdf.worker.min.mjs'">
</nds-pdf-signer>
```

For Angular CLI apps, one common approach is to copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` into your app assets during the build and point `workerSrc` at that served asset.
