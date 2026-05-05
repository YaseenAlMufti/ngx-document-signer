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
