import { Injectable } from '@angular/core';
import {
  drawObject,
  PDFDocument,
  PDFField,
  PDFForm,
  PDFPage,
  PDFRef,
  PDFSignature,
  PDFTextField,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  rotateInPlace,
  translate,
} from 'pdf-lib';
import {
  DocumentSignerField,
  DocumentSignerFillOptions,
  DocumentSignerSignatureValue,
  DocumentSignerSource,
  DocumentSignerTextValue,
} from './document-signer.models';
import { sourceToBytes } from './pdf-viewer-loader';

@Injectable({
  providedIn: 'root'
})
export class NgxDocumentSignerService {
  async createFormPdf(source: DocumentSignerSource, fields: DocumentSignerField[]): Promise<Uint8Array> {
    const bytes = await sourceToBytes(source);
    const document = await PDFDocument.load(bytes);
    const form = document.getForm();
    const requestedFieldNames = new Set(fields.map((field) => field.name));

    for (const field of form.getFields()) {
      if (this.supportedFieldType(field) && !requestedFieldNames.has(field.getName())) {
        this.removeField(form, field);
      }
    }

    const existingFieldNames = new Set(form.getFields().map((field) => field.getName()));

    for (const field of fields) {
      if (existingFieldNames.has(field.name)) {
        continue;
      }

      const page = document.getPage(field.pageIndex);
      const pdfField = form.createTextField(field.name);
      pdfField.setText(field.value ?? '');
      pdfField.addToPage(page, {
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        borderWidth: field.type === 'date' ? 0 : 1,
        borderColor: field.type === 'signature' ? rgb(0.05, 0.35, 0.7) : rgb(0.2, 0.2, 0.2),
        textColor: rgb(0, 0, 0),
      });
      this.setTextFieldFontSize(pdfField, field.height);
      existingFieldNames.add(field.name);
    }

    return document.save();
  }

  async fillPdf(
    source: DocumentSignerSource,
    textValues: DocumentSignerTextValue[],
    signatureValues: DocumentSignerSignatureValue[],
    options: DocumentSignerFillOptions = {},
  ): Promise<Uint8Array> {
    const bytes = await sourceToBytes(source);
    const document = await PDFDocument.load(bytes);
    const form = document.getForm();
    const fields = this.extractFieldsFromDocument(document);
    const fieldsToFlatten = new Set<string>();

    for (const item of textValues) {
      const field = form.getField(item.fieldName);
      if (field instanceof PDFTextField) {
        field.setText(item.value);
        const signerField = fields.find((candidate) => candidate.name === item.fieldName);
        this.setTextFieldFontSize(field, signerField?.height);
        if (item.value.trim()) {
          fieldsToFlatten.add(item.fieldName);
        }
      }
    }

    for (const item of signatureValues) {
      const field = fields.find((candidate) => candidate.name === item.fieldName);
      if (!field || !item.dataUrl) {
        continue;
      }

      const png = await document.embedPng(item.dataUrl);
      const page = document.getPage(field.pageIndex);
      const imageRect = this.fitImageInRect(
        png.width,
        png.height,
        field.x + 4,
        field.y + 4,
        Math.max(1, field.width - 8),
        Math.max(1, field.height - 8),
      );
      page.drawImage(png, {
        x: imageRect.x,
        y: imageRect.y,
        width: imageRect.width,
        height: imageRect.height,
      });
      const formField = form.getField(field.name);
      if (formField instanceof PDFTextField) {
        formField.setText('Signed');
      }
      fieldsToFlatten.add(field.name);
    }

    if (options.partialFlatten) {
      this.flattenFields(form, fieldsToFlatten);
    } else {
      form.flatten();
    }
    return document.save();
  }

  async extractFields(source: DocumentSignerSource): Promise<DocumentSignerField[]> {
    const bytes = await sourceToBytes(source);
    const document = await PDFDocument.load(bytes);
    return this.extractFieldsFromDocument(document);
  }

  createBlob(bytes: Uint8Array): Blob {
    return new Blob([bytes], { type: 'application/pdf' });
  }

  private removeField(form: PDFForm, field: PDFField): void {
    try {
      form.removeField(field);
    } catch (error) {
      if (!this.isAppearanceRemovalError(error)) {
        throw error;
      }

      this.removeFieldWithoutAppearance(form, field);
    }
  }

  private removeFieldWithoutAppearance(form: PDFForm, field: PDFField): void {
    const formApi = form as unknown as {
      doc: {
        context: {
          getObjectRef: (object: unknown) => PDFRef | undefined;
          delete: (ref: PDFRef) => boolean;
        };
      };
      acroForm: {
        removeField: (field: unknown) => void;
      };
      findWidgetPage: (widget: unknown) => PDFPage;
    };
    const pages = new Set<PDFPage>();

    for (const widget of field.acroField.getWidgets()) {
      const widgetRef = formApi.doc.context.getObjectRef((widget as { dict: unknown }).dict);
      const page = formApi.findWidgetPage(widget);
      pages.add(page);

      if (widgetRef) {
        page.node.removeAnnot(widgetRef);
      }
    }

    for (const page of pages) {
      page.node.removeAnnot(field.ref);
    }

    formApi.acroForm.removeField(field.acroField);

    const fieldKids = field.acroField.normalizedEntries().Kids;
    for (let childIndex = 0; childIndex < fieldKids.size(); childIndex += 1) {
      const child = fieldKids.get(childIndex);
      if (child instanceof PDFRef) {
        formApi.doc.context.delete(child);
      }
    }

    formApi.doc.context.delete(field.ref);
  }

  private isAppearanceRemovalError(error: unknown): boolean {
    return error instanceof Error
      && (error.message.startsWith('Unexpected N type') || error.message.startsWith('Failed to extract appearance ref'));
  }

  private flattenFields(form: PDFForm, fieldNames: Set<string>): void {
    if (fieldNames.size === 0) {
      return;
    }

    form.updateFieldAppearances();
    const formApi = form as unknown as {
      findWidgetPage: (widget: unknown) => PDFPage;
      findWidgetAppearanceRef: (field: PDFField, widget: unknown) => PDFRef;
    };

    for (const field of form.getFields()) {
      if (!fieldNames.has(field.getName())) {
        continue;
      }

      for (const widget of field.acroField.getWidgets()) {
        const page = formApi.findWidgetPage(widget);
        const widgetRef = formApi.findWidgetAppearanceRef(field, widget);
        const xObjectKey = page.node.newXObject('FlatWidget', widgetRef);
        const rectangle = widget.getRectangle();
        page.pushOperators(
          ...[
            pushGraphicsState(),
            translate(rectangle.x, rectangle.y),
            ...rotateInPlace({ ...rectangle, rotation: 0 }),
            drawObject(xObjectKey),
            popGraphicsState(),
          ].filter(Boolean),
        );
      }

      form.removeField(field);
    }
  }

  private setTextFieldFontSize(field: PDFTextField, fieldHeight?: number): void {
    const fontSize = Math.max(8, Math.min(12, Math.floor((fieldHeight ?? 24) * 0.45)));
    try {
      field.setFontSize(fontSize);
    } catch {
      // Some existing PDFs omit a default appearance. pdf-lib can still regenerate one on save.
    }
  }

  private extractFieldsFromDocument(document: PDFDocument): DocumentSignerField[] {
    const form = document.getForm();
    const pages = document.getPages();

    return form.getFields().flatMap((field) => {
      const name = field.getName();
      const type = this.supportedFieldType(field);
      if (!type) {
        return [];
      }
      const widgets = field.acroField.getWidgets();

      return widgets.map((widget, index) => {
        const rectangle = widget.getRectangle();
        const pageIndex = this.findWidgetPageIndex(pages, widget.P());

        return {
          id: `${name}_${index}`,
          name,
          type,
          pageIndex,
          x: rectangle.x,
          y: rectangle.y,
          width: rectangle.width,
          height: rectangle.height,
          value: field instanceof PDFTextField ? field.getText() : undefined,
        };
      });
    });
  }

  private supportedFieldType(field: PDFField): DocumentSignerField['type'] | undefined {
    if (field instanceof PDFSignature || field.getName().startsWith('nds_signature_')) {
      return 'signature';
    }

    if (field.getName().startsWith('nds_date_')) {
      return 'date';
    }

    if (field instanceof PDFTextField) {
      return 'text';
    }

    return undefined;
  }

  private findWidgetPageIndex(pages: PDFPage[], pageRef: unknown): number {
    const index = pages.findIndex((page) => page.ref === pageRef);
    return index >= 0 ? index : 0;
  }

  private fitImageInRect(
    imageWidth: number,
    imageHeight: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): { x: number; y: number; width: number; height: number } {
    const scale = Math.min(width / imageWidth, height / imageHeight);
    const fittedWidth = imageWidth * scale;
    const fittedHeight = imageHeight * scale;
    return {
      x: x + (width - fittedWidth) / 2,
      y: y + (height - fittedHeight) / 2,
      width: fittedWidth,
      height: fittedHeight,
    };
  }
}
