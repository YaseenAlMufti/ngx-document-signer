import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DocumentSignerCompletedEvent,
  DocumentSignerSaveEvent,
  DocumentSignerSignatureFontOption,
  PdfCreatorComponent,
  PdfSignerComponent,
} from 'ngx-document-signer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, PdfCreatorComponent, PdfSignerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  @ViewChild(PdfCreatorComponent) creator?: PdfCreatorComponent;
  @ViewChild(PdfSignerComponent) signer?: PdfSignerComponent;

  mode: 'creator' | 'signer' = 'creator';
  createdPdf?: Uint8Array;
  createdBlob?: Blob;
  createdUrl?: string;
  signedBlob?: Blob;
  signedUrl?: string;
  signedSize?: string;
  showCreatorBrowse = true;
  showCreatorFieldTools = true;
  showSaveButtons = true;
  partialFlattenOnSave = false;
  signatureFonts: DocumentSignerSignatureFontOption[] = [
    { label: 'Cursive', value: 'Brush Script MT, Segoe Script, cursive' },
    { label: 'Formal', value: 'Georgia, Times New Roman, serif' },
    { label: 'Classic', value: 'Times New Roman, serif' },
    { label: 'Modern', value: 'Arial, sans-serif' },
  ];
  activePalette = 'teal';
  palettes: Record<string, DemoPalette> = {
    teal: {
      name: 'Teal',
      pageBackground: '#eef2f3',
      accent: '#0f766e',
      accentText: '#ffffff',
      toolbar: '#ffffff',
      button: '#ffffff',
      text: '#172033',
      border: '#c9d3df',
    },
    graphite: {
      name: 'Graphite',
      pageBackground: '#f3f4f6',
      accent: '#27272a',
      accentText: '#ffffff',
      toolbar: '#fafafa',
      button: '#ffffff',
      text: '#18181b',
      border: '#a1a1aa',
    },
    citrus: {
      name: 'Citrus',
      pageBackground: '#fff7ed',
      accent: '#b45309',
      accentText: '#ffffff',
      toolbar: '#fffbeb',
      button: '#ffffff',
      text: '#2f2418',
      border: '#f59e0b',
    },
  };

  get palette(): DemoPalette {
    return this.palettes[this.activePalette];
  }

  get shellStyle(): Record<string, string> {
    return {
      borderColor: this.palette.border,
      background: this.palette.pageBackground,
    };
  }

  get toolbarStyle(): Record<string, string> {
    return {
      background: this.palette.toolbar,
      borderColor: this.palette.border,
    };
  }

  get buttonStyle(): Record<string, string> {
    return {
      background: this.palette.button,
      borderColor: this.palette.border,
      color: this.palette.text,
    };
  }

  get primaryButtonStyle(): Record<string, string> {
    return {
      background: this.palette.accent,
      borderColor: this.palette.accent,
      color: this.palette.accentText,
    };
  }

  get activeButtonStyle(): Record<string, string> {
    return this.primaryButtonStyle;
  }

  handleCreated(event: DocumentSignerSaveEvent): void {
    this.revokeUrl(this.createdUrl);
    this.revokeUrl(this.signedUrl);
    this.createdPdf = event.bytes;
    this.createdBlob = event.blob;
    this.createdUrl = URL.createObjectURL(event.blob);
    this.signedBlob = undefined;
    this.signedUrl = undefined;
    this.signedSize = undefined;
    this.mode = 'signer';
  }

  handleSigned(event: DocumentSignerCompletedEvent): void {
    this.revokeUrl(this.signedUrl);
    this.signedBlob = event.blob;
    this.signedUrl = URL.createObjectURL(event.blob);
    this.signedSize = this.formatBytes(event.blob.size);
  }

  downloadCreatedPdf(): void {
    this.downloadBlob(this.createdBlob, 'created-form.pdf');
  }

  downloadSignedPdf(): void {
    this.downloadBlob(this.signedBlob, 'signed-form.pdf');
  }

  openCreatorPicker(): void {
    this.creator?.openFilePicker();
  }

  saveFromCreator(): void {
    void this.creator?.save();
  }

  saveFromSigner(): void {
    void this.signer?.save();
  }

  downloadFromSigner(): void {
    void this.signer?.download();
  }

  private revokeUrl(url?: string): void {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  private downloadBlob(blob: Blob | undefined, filename: string): void {
    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    return `${(bytes / 1024).toFixed(1)} KB`;
  }
}

interface DemoPalette {
  name: string;
  pageBackground: string;
  accent: string;
  accentText: string;
  toolbar: string;
  button: string;
  text: string;
  border: string;
}
