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
