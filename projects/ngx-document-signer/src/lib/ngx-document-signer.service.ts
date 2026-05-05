import { Injectable } from '@angular/core';
import { PDFDocument, PDFField, PDFPage, PDFSignature, PDFTextField, rgb } from 'pdf-lib';
import {
  DocumentSignerField,
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
        borderWidth: 1,
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
  ): Promise<Uint8Array> {
    const bytes = await sourceToBytes(source);
    const document = await PDFDocument.load(bytes);
    const form = document.getForm();
    const fields = this.extractFieldsFromDocument(document);

    for (const item of textValues) {
      const field = form.getField(item.fieldName);
      if (field instanceof PDFTextField) {
        field.setText(item.value);
        const signerField = fields.find((candidate) => candidate.name === item.fieldName);
        this.setTextFieldFontSize(field, signerField?.height);
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
    }

    form.flatten();
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
