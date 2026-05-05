# ngx-document-signer

Reusable Angular PDF creator and signer components.

## Components

`PdfCreatorComponent` lets a creator browse for a PDF, preview it, page through it, zoom, draw text/signature boxes, and save a new PDF containing AcroForm fields at those coordinates.

`PdfSignerComponent` accepts a PDF href, `Blob`, `ArrayBuffer`, or `Uint8Array`, previews the PDF, discovers the creator fields, lets the signer type text or draw a signature, and emits the signed PDF bytes on save.

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
  [buttonStyle]="{ borderRadius: '999px' }"
  [primaryButtonStyle]="{ background: '#0f766e', color: '#fff' }">
</nds-pdf-creator>

<nds-pdf-signer
  [source]="createdPdf"
  saveBtnLabel="Finish signing"
  signatureFieldPlaceholder="Tap to sign"
  signatureDialogTitle="Draw your signature"
  [toolbarStyle]="{ background: '#fff' }"
  [primaryButtonClass]="'my-primary-button'">
</nds-pdf-signer>
```

Useful public methods include `openFilePicker()`, `load(source)`, `save()`, and `download(filename)`.

## Angular support

- Use `ngx-document-signer@1.x` for Angular 14-16 projects.
- Use `ngx-document-signer@2.x` for Angular 17+ projects.

Both release lines expose the same public components and events. The repository keeps release profiles in `release-profiles/` so each major can be built with the correct Angular compiler and peer dependency range.

## License and support

This project is released under the MIT License. Packages and redistributed copies must keep the copyright and license notice, which gives credit to Yaseen Al Mufti.

Donation link: https://github.com/sponsors/yaseenalmufti
