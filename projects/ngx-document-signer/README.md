# ngx-document-signer

Reusable Angular PDF creator and signer components.

## Components

`PdfCreatorComponent` lets a creator browse for a PDF, preview it, page through it, zoom, draw text/date/signature boxes, and save a new PDF containing AcroForm fields at those coordinates.

`PdfSignerComponent` accepts a PDF href, `Blob`, `ArrayBuffer`, or `Uint8Array`, previews the PDF, discovers the creator fields, lets the signer type text, insert today's date, draw a signature, or type a signature with a selected font, and emits the signed PDF bytes on save.

## Usage

```ts
import { PdfCreatorComponent, PdfSignerComponent } from 'ngx-document-signer';
```

```html
<nds-pdf-creator (saved)="handleCreatedPdf($event.bytes)"></nds-pdf-creator>

<nds-pdf-signer
  [source]="createdPdf"
  (completed)="handleSignedPdf($event.bytes)">
</nds-pdf-signer>
```

The `saved` and `completed` events also include a PDF `Blob`.

If your app needs explicit PDF.js worker control, pass `[workerSrc]` to either component.

## Customization

Most UI outside the PDF preview canvas can be customized with inputs:

```html
<nds-pdf-creator
  [showBrowseButton]="true"
  [showAddTextboxButton]="true"
  [showAddSignatureButton]="true"
  browseBtnLabel="Choose PDF"
  addTextboxBtnLabel="Add text box"
  addSignatureBtnLabel="Add signature"
  addDateboxBtnLabel="Add date"
  [buttonStyle]="{ borderRadius: '999px' }"
  [primaryButtonStyle]="{ background: '#0f766e', color: '#fff' }">
</nds-pdf-creator>

<nds-pdf-signer
  [source]="createdPdf"
  saveBtnLabel="Finish signing"
  signatureFieldPlaceholder="Tap to sign"
  signatureDialogTitle="Add your signature"
  signatureDrawModeLabel="Draw"
  signatureTypeModeLabel="Type"
  signatureTextPlaceholder="Type your full name"
  todayBtnTitle="Use today's date"
  [toolbarStyle]="{ background: '#fff' }"
  [primaryButtonClass]="'my-primary-button'">
</nds-pdf-signer>
```

Useful public methods include `openFilePicker()`, `load(source)`, `save()`, and `download(filename)`.

On screens at least 1024px wide, the creator and signer previews open at `1.8x` zoom by default. Smaller screens open at `1x` to keep mobile layouts usable.

Saved creator fields are visually transparent by default: generated PDF widgets have no border and no filled background. Existing supported fields that remain in the creator are also normalized to remove widget border/background styling on save.

## Flattening behavior

By default, signer saves flatten the entire PDF form so completed documents are no longer editable. If your workflow needs untouched fields to remain editable, enable partial flattening:

```html
<nds-pdf-signer
  [source]="createdPdf"
  [partialFlattenOnSave]="true">
</nds-pdf-signer>
```

When `partialFlattenOnSave` is enabled, only fields with signer-provided values are flattened. Empty text/date fields and unsigned signature fields remain as editable form fields.

## Date fields

Creator date boxes are saved as PDF text fields with an `nds_date_` prefix. The signer renders those fields as native `input type="date"` controls with a compact icon button for today's date.

The browser input value uses the native ISO format `YYYY-MM-DD`. When the signed PDF is saved, the default PDF value is formatted as US-style `MM/DD/YYYY`, and generated date fields are borderless in the final PDF. Override `datePdfValueFormatter` if your project needs a different saved date format:

```html
<nds-pdf-signer
  [source]="createdPdf"
  [datePdfValueFormatter]="formatDateForPdf">
</nds-pdf-signer>
```

## Signature fields

Signature fields can be completed by drawing freehand or typing a name and selecting a font. Override the available typed signature fonts with `signatureFontOptions`:

```ts
signatureFonts = [
  { label: 'Cursive', value: 'Brush Script MT, Segoe Script, cursive' },
  { label: 'Formal', value: 'Georgia, Times New Roman, serif' },
  { label: 'Modern', value: 'Arial, sans-serif' },
];
```

```html
<nds-pdf-signer
  [source]="createdPdf"
  [signatureFontOptions]="signatureFonts">
</nds-pdf-signer>
```

## Angular support

- Use `ngx-document-signer@1.x` for Angular 14-16 projects.
- Use `ngx-document-signer@2.x` for Angular 17+ projects.

Both release lines expose the same public components and events. The repository keeps release profiles in `release-profiles/` so each major can be built with the correct Angular compiler and peer dependency range.

## License and support

This project is released under the MIT License. Packages and redistributed copies must keep the copyright and license notice, which gives credit to Yaseen Al Mufti.

Donation link: https://github.com/sponsors/yaseenalmufti

## PDF.js worker

By default, `ngx-document-signer` loads the matching PDF.js worker from the unpkg CDN when you do not pass `workerSrc`:

```text
Angular 14-16 / ngx-document-signer@1.x:
https://unpkg.com/pdfjs-dist@<pdfjs-version>/build/pdf.worker.min.js

Angular 17+ / ngx-document-signer@2.x:
https://unpkg.com/pdfjs-dist@<pdfjs-version>/build/pdf.worker.min.mjs
```

This default avoids broken `file://node_modules` worker URLs in older Angular/Webpack projects, but it also means the browser may fetch a runtime asset from a third-party CDN.

For CSP-restricted, offline, private-network, or compliance-sensitive apps, self-host the worker and pass a browser-accessible URL:

```html
<nds-pdf-creator [workerSrc]="'assets/pdfjs/pdf.worker.min.js'"></nds-pdf-creator>

<nds-pdf-signer
  [source]="pdfSource"
  [workerSrc]="'assets/pdfjs/pdf.worker.min.js'">
</nds-pdf-signer>
```

For Angular CLI apps, copy the matching worker from `node_modules/pdfjs-dist/build/` into your app assets during the build and point `workerSrc` at that served asset. Use `pdf.worker.min.js` with the Angular 14-16 package line and `pdf.worker.min.mjs` with the Angular 17+ package line.
