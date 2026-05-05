import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  DocumentSignerClassValue,
  DocumentSignerField,
  DocumentSignerFieldType,
  DocumentSignerSaveEvent,
  DocumentSignerSource,
  DocumentSignerStyleValue,
} from './document-signer.models';
import { NgxDocumentSignerService } from './ngx-document-signer.service';
import { loadPdfDocument, renderPdfPage } from './pdf-viewer-loader';

@Component({
  selector: 'nds-pdf-creator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="nds-shell" [ngClass]="shellClass" [ngStyle]="shellStyle">
      <div *ngIf="showToolbar" class="nds-toolbar" [ngClass]="toolbarClass" [ngStyle]="toolbarStyle">
        <label *ngIf="showBrowseButton" class="nds-button"
          [ngClass]="buttonClasses('browse')"
          [ngStyle]="buttonStyles('browse')">
          {{ browseBtnLabel }}
          <input #fileInput type="file" accept="application/pdf" (change)="browse($event)" />
        </label>
        <button *ngIf="showAddTextboxButton" type="button" (click)="setTool('text')" [class.active]="tool === 'text'"
          [ngClass]="buttonClasses('text')"
          [ngStyle]="buttonStyles('text')">{{ addTextboxBtnLabel }}</button>
        <button *ngIf="showAddSignatureButton" type="button" (click)="setTool('signature')" [class.active]="tool === 'signature'"
          [ngClass]="buttonClasses('signature')"
          [ngStyle]="buttonStyles('signature')">{{ addSignatureBtnLabel }}</button>
        <button *ngIf="showAddDateboxButton" type="button" (click)="setTool('date')" [class.active]="tool === 'date'"
          [ngClass]="buttonClasses('date')"
          [ngStyle]="buttonStyles('date')">{{ addDateboxBtnLabel }}</button>
        <span class="nds-spacer"></span>
        <ng-container *ngIf="showPageControls">
          <button type="button" (click)="previousPage()" [disabled]="pageIndex === 0"
            [ngClass]="buttonClasses('previous')"
            [ngStyle]="buttonStyles('previous')">{{ previousPageBtnLabel }}</button>
          <span *ngIf="showPageIndicator" [ngClass]="pageIndicatorClass" [ngStyle]="pageIndicatorStyle">
            {{ pageIndex + 1 }} / {{ pageCount || 1 }}
          </span>
          <button type="button" (click)="nextPage()" [disabled]="pageIndex >= pageCount - 1"
            [ngClass]="buttonClasses('next')"
            [ngStyle]="buttonStyles('next')">{{ nextPageBtnLabel }}</button>
        </ng-container>
        <ng-container *ngIf="showZoomControls">
          <button type="button" (click)="zoomOut()"
            [ngClass]="buttonClasses('zoomOut')"
            [ngStyle]="buttonStyles('zoomOut')">{{ zoomOutBtnLabel }}</button>
          <span *ngIf="showZoomIndicator" [ngClass]="zoomIndicatorClass" [ngStyle]="zoomIndicatorStyle">
            {{ zoom | number: '1.1-1' }}x
          </span>
          <button type="button" (click)="zoomIn()"
            [ngClass]="buttonClasses('zoomIn')"
            [ngStyle]="buttonStyles('zoomIn')">{{ zoomInBtnLabel }}</button>
        </ng-container>
        <button *ngIf="showSaveButton" type="button" class="primary" (click)="save()" [disabled]="!source"
          [ngClass]="buttonClasses('save')"
          [ngStyle]="buttonStyles('save')">{{ saveBtnLabel }}</button>
      </div>

      <div class="nds-stage" *ngIf="source; else emptyState" [ngClass]="stageClass" [ngStyle]="stageStyle">
        <div class="nds-page" [style.width.px]="viewportWidth" [style.height.px]="viewportHeight"
          (pointerdown)="startDraw($event)" (pointermove)="draw($event)" (pointerup)="endDraw($event)">
          <canvas #canvas></canvas>
          <div
            *ngFor="let field of visibleFields"
            class="nds-field"
            [class.signature]="field.type === 'signature'"
            [class.date]="field.type === 'date'"
            [style.left.px]="toViewRect(field).x"
            [style.top.px]="toViewRect(field).y"
            [style.width.px]="toViewRect(field).width"
            [style.height.px]="toViewRect(field).height">
            {{ fieldLabel(field) }}
            <button *ngIf="showRemoveFieldButton" type="button" [title]="removeFieldBtnTitle" (click)="removeField(field.id)"
              [ngClass]="buttonClasses('remove')"
              [ngStyle]="buttonStyles('remove')">{{ removeFieldBtnLabel }}</button>
          </div>
          <div *ngIf="draftRect" class="nds-field draft"
            [style.left.px]="draftRect.x" [style.top.px]="draftRect.y"
            [style.width.px]="draftRect.width" [style.height.px]="draftRect.height"></div>
        </div>
      </div>

      <ng-template #emptyState>
        <div class="nds-empty" [ngClass]="emptyStateClass" [ngStyle]="emptyStateStyle">{{ emptyStateText }}</div>
      </ng-template>
    </section>
  `,
  styles: [`
    :host { display: block; font-family: Arial, sans-serif; color: #1f2937; }
    .nds-shell { border: 1px solid #d1d5db; background: #f8fafc; }
    .nds-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid #d1d5db; background: #fff; flex-wrap: wrap; }
    button, .nds-button { border: 1px solid #cbd5e1; background: #fff; padding: 7px 10px; border-radius: 6px; cursor: pointer; font: inherit; }
    button:disabled { opacity: .45; cursor: not-allowed; }
    button.active, button.primary { background: #0f766e; color: #fff; border-color: #0f766e; }
    input[type=file] { display: none; }
    .nds-spacer { flex: 1 1 auto; }
    .nds-stage { overflow: auto; padding: 18px; max-height: 75vh; }
    .nds-page { position: relative; margin: 0 auto; box-shadow: 0 10px 28px rgba(15, 23, 42, .2); background: white; touch-action: none; }
    canvas { display: block; }
    .nds-field { position: absolute; display: flex; align-items: center; justify-content: center; min-width: 24px; min-height: 18px; border: 2px solid #374151; background: rgba(255,255,255,.35); color: #111827; font-size: 12px; }
    .nds-field.signature { border-color: #0f766e; color: #0f766e; }
    .nds-field.date { border-color: #7c3aed; color: #5b21b6; }
    .nds-field.draft { pointer-events: none; border-style: dashed; }
    .nds-field button { position: absolute; top: -12px; right: -12px; width: 22px; height: 22px; padding: 0; border-radius: 50%; line-height: 1; }
    .nds-empty { padding: 48px 16px; text-align: center; color: #64748b; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfCreatorComponent implements AfterViewInit, OnChanges {
  @Input() pdf?: DocumentSignerSource;
  @Input() workerSrc?: string;
  @Input() showToolbar = true;
  @Input() showBrowseButton = true;
  @Input() showAddTextboxButton = true;
  @Input() showAddSignatureButton = true;
  @Input() showAddDateboxButton = true;
  @Input() showPageControls = true;
  @Input() showPageIndicator = true;
  @Input() showZoomControls = true;
  @Input() showZoomIndicator = true;
  @Input() showSaveButton = true;
  @Input() showRemoveFieldButton = true;
  @Input() browseBtnLabel = 'Browse';
  @Input() addTextboxBtnLabel = 'Text';
  @Input() addSignatureBtnLabel = 'Signature';
  @Input() addDateboxBtnLabel = 'Date';
  @Input() previousPageBtnLabel = 'Previous';
  @Input() nextPageBtnLabel = 'Next';
  @Input() zoomOutBtnLabel = '-';
  @Input() zoomInBtnLabel = '+';
  @Input() saveBtnLabel = 'Save';
  @Input() removeFieldBtnLabel = 'x';
  @Input() removeFieldBtnTitle = 'Remove field';
  @Input() textFieldLabel = 'Text';
  @Input() signatureFieldLabel = 'Signature';
  @Input() dateFieldLabel = 'Date';
  @Input() emptyStateText = 'Choose a PDF to begin.';
  @Input() shellClass?: DocumentSignerClassValue;
  @Input() toolbarClass?: DocumentSignerClassValue;
  @Input() stageClass?: DocumentSignerClassValue;
  @Input() emptyStateClass?: DocumentSignerClassValue;
  @Input() buttonClass?: DocumentSignerClassValue;
  @Input() primaryButtonClass?: DocumentSignerClassValue;
  @Input() activeButtonClass?: DocumentSignerClassValue;
  @Input() browseButtonClass?: DocumentSignerClassValue;
  @Input() addTextboxButtonClass?: DocumentSignerClassValue;
  @Input() addSignatureButtonClass?: DocumentSignerClassValue;
  @Input() addDateboxButtonClass?: DocumentSignerClassValue;
  @Input() previousPageButtonClass?: DocumentSignerClassValue;
  @Input() nextPageButtonClass?: DocumentSignerClassValue;
  @Input() zoomOutButtonClass?: DocumentSignerClassValue;
  @Input() zoomInButtonClass?: DocumentSignerClassValue;
  @Input() saveButtonClass?: DocumentSignerClassValue;
  @Input() removeFieldButtonClass?: DocumentSignerClassValue;
  @Input() pageIndicatorClass?: DocumentSignerClassValue;
  @Input() zoomIndicatorClass?: DocumentSignerClassValue;
  @Input() shellStyle?: DocumentSignerStyleValue;
  @Input() toolbarStyle?: DocumentSignerStyleValue;
  @Input() stageStyle?: DocumentSignerStyleValue;
  @Input() emptyStateStyle?: DocumentSignerStyleValue;
  @Input() buttonStyle?: DocumentSignerStyleValue;
  @Input() primaryButtonStyle?: DocumentSignerStyleValue;
  @Input() activeButtonStyle?: DocumentSignerStyleValue;
  @Input() browseButtonStyle?: DocumentSignerStyleValue;
  @Input() addTextboxButtonStyle?: DocumentSignerStyleValue;
  @Input() addSignatureButtonStyle?: DocumentSignerStyleValue;
  @Input() addDateboxButtonStyle?: DocumentSignerStyleValue;
  @Input() previousPageButtonStyle?: DocumentSignerStyleValue;
  @Input() nextPageButtonStyle?: DocumentSignerStyleValue;
  @Input() zoomOutButtonStyle?: DocumentSignerStyleValue;
  @Input() zoomInButtonStyle?: DocumentSignerStyleValue;
  @Input() saveButtonStyle?: DocumentSignerStyleValue;
  @Input() removeFieldButtonStyle?: DocumentSignerStyleValue;
  @Input() pageIndicatorStyle?: DocumentSignerStyleValue;
  @Input() zoomIndicatorStyle?: DocumentSignerStyleValue;
  @Output() pdfChange = new EventEmitter<DocumentSignerSource>();
  @Output() saved = new EventEmitter<DocumentSignerSaveEvent>();
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  source?: DocumentSignerSource;
  fields: DocumentSignerField[] = [];
  pageIndex = 0;
  pageCount = 0;
  zoom = 1;
  tool: DocumentSignerFieldType = 'text';
  viewportWidth = 0;
  viewportHeight = 0;
  draftRect?: Rect;

  private document?: PDFDocumentProxy;
  private pageWidth = 0;
  private pageHeight = 0;
  private drawStart?: Point;

  constructor(private signer: NgxDocumentSignerService, private cdr: ChangeDetectorRef) {}

  get visibleFields(): DocumentSignerField[] {
    return this.fields.filter((field) => field.pageIndex === this.pageIndex);
  }

  async ngAfterViewInit(): Promise<void> {
    if (this.pdf) {
      await this.open(this.pdf);
    }
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['pdf'] && this.pdf && this.canvas) {
      await this.open(this.pdf);
    }
  }

  async browse(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.pdfChange.emit(file);
    await this.open(file);
    input.value = '';
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement.click();
  }

  async load(source: DocumentSignerSource): Promise<void> {
    await this.open(source);
  }

  setTool(tool: DocumentSignerFieldType): void {
    this.tool = tool;
  }

  async previousPage(): Promise<void> {
    if (this.pageIndex > 0) {
      this.pageIndex -= 1;
      await this.render();
    }
  }

  async nextPage(): Promise<void> {
    if (this.pageIndex < this.pageCount - 1) {
      this.pageIndex += 1;
      await this.render();
    }
  }

  async zoomIn(): Promise<void> {
    this.zoom = Math.min(3, this.zoom + 0.25);
    await this.render();
  }

  async zoomOut(): Promise<void> {
    this.zoom = Math.max(0.5, this.zoom - 0.25);
    await this.render();
  }

  startDraw(event: PointerEvent): void {
    if (!this.source || (event.target as HTMLElement).closest('.nds-field')) {
      return;
    }
    this.drawStart = this.eventPoint(event);
    this.draftRect = { ...this.drawStart, width: 1, height: 1 };
  }

  draw(event: PointerEvent): void {
    if (!this.drawStart) {
      return;
    }
    this.draftRect = normalizeRect(this.drawStart, this.eventPoint(event));
  }

  endDraw(event: PointerEvent): void {
    if (!this.drawStart) {
      return;
    }
    const rect = normalizeRect(this.drawStart, this.eventPoint(event));
    this.drawStart = undefined;
    this.draftRect = undefined;

    if (rect.width < 20 || rect.height < 12) {
      return;
    }

    const suffix = `${Date.now()}_${this.fields.length + 1}`;
    this.fields = [
      ...this.fields,
      {
        id: `nds_${suffix}`,
        name: `nds_${this.tool}_${suffix}`,
        type: this.tool,
        pageIndex: this.pageIndex,
        ...this.toPdfRect(rect),
      },
    ];
  }

  removeField(id: string): void {
    this.fields = this.fields.filter((field) => field.id !== id);
  }

  async save(): Promise<DocumentSignerSaveEvent | undefined> {
    if (!this.source) {
      return undefined;
    }
    const bytes = await this.signer.createFormPdf(this.source, this.fields);
    const event = { bytes, blob: this.signer.createBlob(bytes), fields: this.fields };
    this.saved.emit(event);
    return event;
  }

  async download(filename = 'created-form.pdf'): Promise<void> {
    const event = await this.save();
    if (event) {
      downloadBlob(event.blob, filename);
    }
  }

  fieldLabel(field: DocumentSignerField): string {
    if (field.type === 'signature') {
      return this.signatureFieldLabel;
    }

    if (field.type === 'date') {
      return this.dateFieldLabel;
    }

    return this.textFieldLabel;
  }

  buttonClasses(button: CreatorButtonName): DocumentSignerClassValue[] {
    const specific = this.buttonClassFor(button);
    const classes: DocumentSignerClassValue[] = [];
    if (this.buttonClass) classes.push(this.buttonClass);
    if (specific) classes.push(specific);
    if (button === 'save' && this.primaryButtonClass) classes.push(this.primaryButtonClass);
    if (this.isActiveButton(button) && this.activeButtonClass) classes.push(this.activeButtonClass);
    return classes;
  }

  buttonStyles(button: CreatorButtonName): DocumentSignerStyleValue {
    return {
      ...this.buttonStyle,
      ...this.buttonStyleFor(button),
      ...(button === 'save' ? this.primaryButtonStyle : undefined),
      ...(this.isActiveButton(button) ? this.activeButtonStyle : undefined),
    };
  }

  private isActiveButton(button: CreatorButtonName): boolean {
    return (button === 'text' && this.tool === 'text') || (button === 'signature' && this.tool === 'signature') || (button === 'date' && this.tool === 'date');
  }

  private buttonClassFor(button: CreatorButtonName): DocumentSignerClassValue | undefined {
    return {
      browse: this.browseButtonClass,
      text: this.addTextboxButtonClass,
      signature: this.addSignatureButtonClass,
      date: this.addDateboxButtonClass,
      previous: this.previousPageButtonClass,
      next: this.nextPageButtonClass,
      zoomOut: this.zoomOutButtonClass,
      zoomIn: this.zoomInButtonClass,
      save: this.saveButtonClass,
      remove: this.removeFieldButtonClass,
    }[button];
  }

  private buttonStyleFor(button: CreatorButtonName): DocumentSignerStyleValue | undefined {
    return {
      browse: this.browseButtonStyle,
      text: this.addTextboxButtonStyle,
      signature: this.addSignatureButtonStyle,
      date: this.addDateboxButtonStyle,
      previous: this.previousPageButtonStyle,
      next: this.nextPageButtonStyle,
      zoomOut: this.zoomOutButtonStyle,
      zoomIn: this.zoomInButtonStyle,
      save: this.saveButtonStyle,
      remove: this.removeFieldButtonStyle,
    }[button];
  }

  toViewRect(field: DocumentSignerField): Rect {
    const scaleX = this.viewportWidth / this.pageWidth;
    const scaleY = this.viewportHeight / this.pageHeight;
    return {
      x: field.x * scaleX,
      y: this.viewportHeight - (field.y + field.height) * scaleY,
      width: field.width * scaleX,
      height: field.height * scaleY,
    };
  }

  private async open(source: DocumentSignerSource): Promise<void> {
    this.source = source;
    this.document = await loadPdfDocument(source, this.workerSrc);
    this.fields = await this.signer.extractFields(source);
    this.pageCount = this.document.numPages;
    this.pageIndex = 0;
    await this.render();
  }

  private async render(): Promise<void> {
    if (!this.document || !this.canvas) {
      return;
    }
    const page = await this.document.getPage(this.pageIndex + 1);
    const [left, bottom, right, top] = page.view;
    this.pageWidth = right - left;
    this.pageHeight = top - bottom;
    const viewport = await renderPdfPage(page, this.canvas.nativeElement, this.zoom);
    this.viewportWidth = viewport.width;
    this.viewportHeight = viewport.height;
    this.cdr.markForCheck();
  }

  private eventPoint(event: PointerEvent): Point {
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  private toPdfRect(rect: Rect): Omit<DocumentSignerField, 'id' | 'name' | 'type' | 'pageIndex'> {
    const scaleX = this.pageWidth / this.viewportWidth;
    const scaleY = this.pageHeight / this.viewportHeight;
    return {
      x: rect.x * scaleX,
      y: this.pageHeight - (rect.y + rect.height) * scaleY,
      width: rect.width * scaleX,
      height: rect.height * scaleY,
    };
  }
}

interface Point {
  x: number;
  y: number;
}

interface Rect extends Point {
  width: number;
  height: number;
}

function normalizeRect(start: Point, end: Point): Rect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return { x, y, width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

type CreatorButtonName = 'browse' | 'text' | 'signature' | 'date' | 'previous' | 'next' | 'zoomOut' | 'zoomIn' | 'save' | 'remove';

function downloadBlob(blob: Blob, filename: string): void {
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
