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
import { FormsModule } from '@angular/forms';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  DocumentSignerClassValue,
  DocumentSignerCompletedEvent,
  DocumentSignerField,
  DocumentSignerSignatureFontOption,
  DocumentSignerSignatureValue,
  DocumentSignerSource,
  DocumentSignerStyleValue,
  DocumentSignerTextValue,
} from './document-signer.models';
import { NgxDocumentSignerService } from './ngx-document-signer.service';
import { loadPdfDocument, renderPdfPage } from './pdf-viewer-loader';

@Component({
  selector: 'nds-pdf-signer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="nds-shell" *ngIf="source" [ngClass]="shellClass" [ngStyle]="shellStyle">
      <div *ngIf="showToolbar" class="nds-toolbar" [ngClass]="toolbarClass" [ngStyle]="toolbarStyle">
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
        <span class="nds-spacer"></span>
        <button *ngIf="showSaveButton" type="button" class="primary" (click)="save()"
          [ngClass]="buttonClasses('save')"
          [ngStyle]="buttonStyles('save')">{{ saveBtnLabel }}</button>
      </div>

      <div class="nds-stage" [ngClass]="stageClass" [ngStyle]="stageStyle">
        <div class="nds-page" [style.width.px]="viewportWidth" [style.height.px]="viewportHeight">
          <canvas #canvas></canvas>
          <ng-container *ngFor="let field of visibleFields">
            <input *ngIf="field.type === 'text'"
              class="nds-input"
              [style.left.px]="toViewRect(field).x"
              [style.top.px]="toViewRect(field).y"
              [style.width.px]="toViewRect(field).width"
              [style.height.px]="toViewRect(field).height"
              [(ngModel)]="textValues[field.name]" />
            <div *ngIf="field.type === 'date'" class="nds-date"
              [style.left.px]="toViewRect(field).x"
              [style.top.px]="toViewRect(field).y"
              [style.width.px]="toViewRect(field).width"
              [style.height.px]="toViewRect(field).height">
              <input type="date" class="nds-input" [(ngModel)]="textValues[field.name]" />
              <button type="button" class="nds-date-today" (click)="setToday(field.name)"
                [title]="todayBtnTitle"
                [attr.aria-label]="todayBtnAriaLabel"
                [ngClass]="buttonClasses('today')"
                [ngStyle]="buttonStyles('today')">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 2v4" />
                  <path d="M16 2v4" />
                  <path d="M3 10h18" />
                  <path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                  <path d="m9 15 2 2 4-5" />
                </svg>
              </button>
            </div>
            <button *ngIf="field.type === 'signature'" type="button" class="nds-signature"
              [style.left.px]="toViewRect(field).x"
              [style.top.px]="toViewRect(field).y"
              [style.width.px]="toViewRect(field).width"
              [style.height.px]="toViewRect(field).height"
              (click)="openSignatureDialog(field.name)">
              <svg *ngIf="signatureDrawings[field.name]" [attr.viewBox]="viewBox(signatureDrawings[field.name])" preserveAspectRatio="xMidYMid meet">
                <text *ngIf="typedSignature(signatureDrawings[field.name]) as text"
                  [attr.x]="text.x"
                  [attr.y]="text.y"
                  [attr.font-family]="text.fontFamily"
                  [attr.font-size]="text.fontSize"
                  [attr.text-anchor]="text.textAnchor"
                  [attr.dominant-baseline]="text.dominantBaseline"
                  [attr.textLength]="text.textLength"
                  lengthAdjust="spacingAndGlyphs">{{ text.value }}</text>
                <path *ngFor="let path of paths(signatureDrawings[field.name])" [attr.d]="path"></path>
              </svg>
              <span *ngIf="!signatureDrawings[field.name]">{{ signatureFieldPlaceholder }}</span>
            </button>
          </ng-container>
        </div>
      </div>

      <div class="nds-modal-backdrop" *ngIf="activeSignatureFieldName" (click)="closeSignatureDialog()"
        [ngClass]="modalBackdropClass" [ngStyle]="modalBackdropStyle">
        <div class="nds-modal" role="dialog" aria-modal="true" [attr.aria-label]="signatureDialogAriaLabel" (click)="$event.stopPropagation()"
          [ngClass]="modalClass" [ngStyle]="modalStyle">
          <div class="nds-modal-toolbar" [ngClass]="modalToolbarClass" [ngStyle]="modalToolbarStyle">
            <button type="button" class="icon danger" [title]="clearSignatureBtnTitle" [attr.aria-label]="clearSignatureBtnAriaLabel" (click)="clearActiveSignature()"
              [ngClass]="buttonClasses('clearSignature')"
              [ngStyle]="buttonStyles('clearSignature')">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M6 6l1 15h10l1-15" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
            <span class="nds-modal-title" [ngClass]="modalTitleClass" [ngStyle]="modalTitleStyle">{{ signatureDialogTitle }}</span>
            <button type="button" class="icon primary" [title]="acceptSignatureBtnTitle" [attr.aria-label]="acceptSignatureBtnAriaLabel" (click)="acceptSignature()"
              [ngClass]="buttonClasses('acceptSignature')"
              [ngStyle]="buttonStyles('acceptSignature')">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </button>
          </div>

          <div class="nds-signature-mode" [ngClass]="signatureModeClass" [ngStyle]="signatureModeStyle">
            <button type="button" [class.active]="activeSignatureMode === 'draw'" (click)="setSignatureMode('draw')"
              [ngClass]="buttonClasses('signatureModeDraw')"
              [ngStyle]="buttonStyles('signatureModeDraw')">{{ signatureDrawModeLabel }}</button>
            <button type="button" [class.active]="activeSignatureMode === 'type'" (click)="setSignatureMode('type')"
              [ngClass]="buttonClasses('signatureModeType')"
              [ngStyle]="buttonStyles('signatureModeType')">{{ signatureTypeModeLabel }}</button>
          </div>

          <div class="nds-modal-pad" [ngClass]="modalPadClass" [ngStyle]="modalPadStyle">
            <svg #modalSignatureSvg
              *ngIf="activeSignatureMode === 'draw'; else typedSignatureTemplate"
              [attr.viewBox]="viewBox(activeSignatureDrawing)"
              preserveAspectRatio="none"
              (pointerdown)="startModalSignature($event)"
              (pointermove)="drawModalSignature($event)"
              (pointerup)="endModalSignature()"
              (pointerleave)="endModalSignature()"
              (pointercancel)="endModalSignature()">
              <path *ngFor="let path of paths(activeSignatureDrawing)" [attr.d]="path"></path>
            </svg>
            <ng-template #typedSignatureTemplate>
              <div class="nds-typed-signature">
                <div class="nds-typed-controls">
                  <select [(ngModel)]="activeSignatureFontFamily" [attr.aria-label]="signatureFontAriaLabel">
                    <option *ngFor="let font of signatureFontOptions" [ngValue]="font.value">{{ font.label }}</option>
                  </select>
                  <input type="text" [(ngModel)]="activeSignatureText" [placeholder]="signatureTextPlaceholder"
                    [attr.aria-label]="signatureTextAriaLabel" />
                </div>
                <svg [attr.viewBox]="viewBox(typedSignaturePreview())" preserveAspectRatio="xMidYMid meet">
                  <text *ngIf="typedSignature(typedSignaturePreview()) as text"
                    [attr.x]="text.x"
                    [attr.y]="text.y"
                    [attr.font-family]="text.fontFamily"
                    [attr.font-size]="text.fontSize"
                    [attr.text-anchor]="text.textAnchor"
                    [attr.dominant-baseline]="text.dominantBaseline"
                    [attr.textLength]="text.textLength"
                    lengthAdjust="spacingAndGlyphs">{{ text.value }}</text>
                </svg>
              </div>
            </ng-template>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; font-family: Arial, sans-serif; color: #1f2937; }
    .nds-shell { border: 1px solid #d1d5db; background: #f8fafc; }
    .nds-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid #d1d5db; background: #fff; flex-wrap: wrap; }
    button { border: 1px solid #cbd5e1; background: #fff; padding: 7px 10px; border-radius: 6px; cursor: pointer; font: inherit; }
    button:disabled { opacity: .45; cursor: not-allowed; }
    button.primary { background: #0f766e; color: #fff; border-color: #0f766e; }
    .nds-spacer { flex: 1 1 auto; }
    .nds-stage { overflow: auto; padding: 18px; max-height: 75vh; }
    .nds-page { position: relative; margin: 0 auto; box-shadow: 0 10px 28px rgba(15, 23, 42, .2); background: white; }
    canvas { display: block; }
    .nds-input, .nds-signature, .nds-date { position: absolute; box-sizing: border-box; border: 2px solid #0f766e; background: rgba(255,255,255,.72); }
    .nds-input { padding: 4px 6px; font: 14px Arial, sans-serif; }
    .nds-date { display: flex; overflow: hidden; }
    .nds-date .nds-input { position: static; flex: 1 1 auto; width: 100%; min-width: 0; height: 100%; border: 0; background: transparent; }
    .nds-date-today { flex: 0 0 auto; width: min(36px, 32%); min-width: 28px; height: 100%; display: grid; place-items: center; padding: 0; border-width: 0 0 0 1px; border-radius: 0; background: #f8fafc; }
    .nds-date-today svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .nds-signature { display: block; overflow: hidden; padding: 0; color: #0f766e; font-weight: 700; }
    .nds-signature svg { width: 100%; height: 100%; pointer-events: none; }
    .nds-signature path, .nds-modal-pad path { fill: none; stroke: #111827; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    .nds-signature text, .nds-modal-pad text { fill: #111827; }
    .nds-signature span { position: absolute; inset: 0; display: grid; place-items: center; }
    .nds-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: stretch; justify-content: center; background: rgba(15, 23, 42, .58); padding: 12px; }
    .nds-modal { width: min(900px, 100%); min-height: min(520px, calc(100vh - 24px)); display: flex; flex-direction: column; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,.35); }
    .nds-modal-toolbar { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid #d1d5db; }
    .nds-modal-title { text-align: center; font-weight: 700; }
    .nds-modal-toolbar .icon { width: 44px; height: 44px; display: grid; place-items: center; padding: 0; }
    .nds-modal-toolbar .icon svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .nds-modal-toolbar .icon.primary { background: #0f766e; border-color: #0f766e; color: #fff; }
    .nds-modal-toolbar .icon.danger { color: #b42318; }
    .nds-signature-mode { display: flex; gap: 8px; padding: 10px; border-bottom: 1px solid #d1d5db; background: #f8fafc; }
    .nds-signature-mode button.active { background: #0f766e; color: #fff; border-color: #0f766e; }
    .nds-modal-pad { flex: 1; padding: 14px; background: #eef2f3; }
    .nds-modal-pad svg { width: 100%; height: 100%; min-height: 360px; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; touch-action: none; }
    .nds-typed-signature { display: grid; grid-template-rows: auto 1fr; gap: 12px; height: 100%; min-height: 360px; }
    .nds-typed-controls { display: grid; grid-template-columns: minmax(140px, 220px) 1fr; gap: 10px; }
    .nds-typed-controls select, .nds-typed-controls input { box-sizing: border-box; width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; font: inherit; background: #fff; }
    .nds-typed-signature svg { min-height: 300px; }
    @media (max-width: 720px) {
      .nds-modal-backdrop { padding: 0; }
      .nds-modal { width: 100%; min-height: 100vh; border-radius: 0; }
      .nds-modal-pad { padding: 10px; }
      .nds-modal-pad svg { min-height: calc(100vh - 86px); }
      .nds-typed-controls { grid-template-columns: 1fr; }
      .nds-typed-signature { min-height: calc(100vh - 130px); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfSignerComponent implements AfterViewInit, OnChanges {
  @Input() source!: DocumentSignerSource;
  @Input() workerSrc?: string;
  @Input() showToolbar = true;
  @Input() showPageControls = true;
  @Input() showPageIndicator = true;
  @Input() showZoomControls = true;
  @Input() showZoomIndicator = true;
  @Input() showSaveButton = true;
  @Input() partialFlattenOnSave = false;
  @Input() previousPageBtnLabel = 'Previous';
  @Input() nextPageBtnLabel = 'Next';
  @Input() zoomOutBtnLabel = '-';
  @Input() zoomInBtnLabel = '+';
  @Input() saveBtnLabel = 'Save';
  @Input() todayBtnLabel = 'Today';
  @Input() todayBtnTitle = 'Use today';
  @Input() todayBtnAriaLabel = 'Use today';
  @Input() dateValueFormatter: (date: Date) => string = defaultDateValueFormatter;
  @Input() datePdfValueFormatter: (value: string) => string = defaultDatePdfValueFormatter;
  @Input() signatureFieldPlaceholder = 'Sign';
  @Input() signatureDialogTitle = 'Signature';
  @Input() signatureDialogAriaLabel = 'Draw signature';
  @Input() signatureDrawModeLabel = 'Draw';
  @Input() signatureTypeModeLabel = 'Type';
  @Input() signatureFontAriaLabel = 'Signature font';
  @Input() signatureTextAriaLabel = 'Signature text';
  @Input() signatureTextPlaceholder = 'Type your full name';
  @Input() signatureFontOptions: DocumentSignerSignatureFontOption[] = defaultSignatureFontOptions();
  @Input() clearSignatureBtnTitle = 'Clear signature';
  @Input() clearSignatureBtnAriaLabel = 'Clear signature';
  @Input() acceptSignatureBtnTitle = 'Accept signature';
  @Input() acceptSignatureBtnAriaLabel = 'Accept signature';
  @Input() shellClass?: DocumentSignerClassValue;
  @Input() toolbarClass?: DocumentSignerClassValue;
  @Input() stageClass?: DocumentSignerClassValue;
  @Input() buttonClass?: DocumentSignerClassValue;
  @Input() primaryButtonClass?: DocumentSignerClassValue;
  @Input() previousPageButtonClass?: DocumentSignerClassValue;
  @Input() nextPageButtonClass?: DocumentSignerClassValue;
  @Input() zoomOutButtonClass?: DocumentSignerClassValue;
  @Input() zoomInButtonClass?: DocumentSignerClassValue;
  @Input() saveButtonClass?: DocumentSignerClassValue;
  @Input() todayButtonClass?: DocumentSignerClassValue;
  @Input() acceptSignatureButtonClass?: DocumentSignerClassValue;
  @Input() clearSignatureButtonClass?: DocumentSignerClassValue;
  @Input() pageIndicatorClass?: DocumentSignerClassValue;
  @Input() zoomIndicatorClass?: DocumentSignerClassValue;
  @Input() modalBackdropClass?: DocumentSignerClassValue;
  @Input() modalClass?: DocumentSignerClassValue;
  @Input() modalToolbarClass?: DocumentSignerClassValue;
  @Input() modalTitleClass?: DocumentSignerClassValue;
  @Input() modalPadClass?: DocumentSignerClassValue;
  @Input() signatureModeClass?: DocumentSignerClassValue;
  @Input() shellStyle?: DocumentSignerStyleValue;
  @Input() toolbarStyle?: DocumentSignerStyleValue;
  @Input() stageStyle?: DocumentSignerStyleValue;
  @Input() buttonStyle?: DocumentSignerStyleValue;
  @Input() primaryButtonStyle?: DocumentSignerStyleValue;
  @Input() previousPageButtonStyle?: DocumentSignerStyleValue;
  @Input() nextPageButtonStyle?: DocumentSignerStyleValue;
  @Input() zoomOutButtonStyle?: DocumentSignerStyleValue;
  @Input() zoomInButtonStyle?: DocumentSignerStyleValue;
  @Input() saveButtonStyle?: DocumentSignerStyleValue;
  @Input() todayButtonStyle?: DocumentSignerStyleValue;
  @Input() acceptSignatureButtonStyle?: DocumentSignerStyleValue;
  @Input() clearSignatureButtonStyle?: DocumentSignerStyleValue;
  @Input() pageIndicatorStyle?: DocumentSignerStyleValue;
  @Input() zoomIndicatorStyle?: DocumentSignerStyleValue;
  @Input() modalBackdropStyle?: DocumentSignerStyleValue;
  @Input() modalStyle?: DocumentSignerStyleValue;
  @Input() modalToolbarStyle?: DocumentSignerStyleValue;
  @Input() modalTitleStyle?: DocumentSignerStyleValue;
  @Input() modalPadStyle?: DocumentSignerStyleValue;
  @Input() signatureModeStyle?: DocumentSignerStyleValue;
  @Output() completed = new EventEmitter<DocumentSignerCompletedEvent>();
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('modalSignatureSvg') modalSignatureSvg?: ElementRef<SVGSVGElement>;

  fields: DocumentSignerField[] = [];
  textValues: Record<string, string> = {};
  signatureDrawings: Record<string, SignatureDrawing> = {};
  activeSignatureDrawing: SignatureDrawing = emptyDrawing();
  activeSignatureMode: SignatureMode = 'draw';
  activeSignatureText = '';
  activeSignatureFontFamily = defaultSignatureFontOptions()[0].value;
  activeSignatureFieldName?: string;
  pageIndex = 0;
  pageCount = 0;
  zoom = defaultPreviewZoom();
  viewportWidth = 0;
  viewportHeight = 0;

  private document?: PDFDocumentProxy;
  private pageWidth = 0;
  private pageHeight = 0;
  private isDrawingSignature = false;

  constructor(private signer: NgxDocumentSignerService, private cdr: ChangeDetectorRef) {}

  get visibleFields(): DocumentSignerField[] {
    return this.fields.filter((field) => field.pageIndex === this.pageIndex);
  }

  async ngAfterViewInit(): Promise<void> {
    await this.open();
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['source'] && this.canvas) {
      await this.open();
    }
  }

  async load(source: DocumentSignerSource): Promise<void> {
    this.source = source;
    await this.open();
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

  openSignatureDialog(fieldName: string): void {
    this.activeSignatureFieldName = fieldName;
    this.activeSignatureDrawing = cloneDrawing(this.signatureDrawings[fieldName] ?? emptyDrawing());
    const typed = this.activeSignatureDrawing.text;
    this.activeSignatureMode = typed ? 'type' : 'draw';
    this.activeSignatureText = typed?.value ?? '';
    this.activeSignatureFontFamily = typed?.fontFamily ?? this.signatureFontOptions[0]?.value ?? defaultSignatureFontOptions()[0].value;
    this.cdr.markForCheck();
    setTimeout(() => this.resizeActiveDrawing());
  }

  closeSignatureDialog(): void {
    this.activeSignatureFieldName = undefined;
    this.activeSignatureDrawing = emptyDrawing();
    this.activeSignatureMode = 'draw';
    this.activeSignatureText = '';
    this.isDrawingSignature = false;
    this.cdr.markForCheck();
  }

  setSignatureMode(mode: SignatureMode): void {
    this.activeSignatureMode = mode;
    if (mode === 'draw') {
      setTimeout(() => this.resizeActiveDrawing());
    }
  }

  startModalSignature(event: PointerEvent): void {
    this.resizeActiveDrawing();
    this.isDrawingSignature = true;
    this.activeSignatureDrawing.strokes = [
      ...this.activeSignatureDrawing.strokes,
      [this.svgPoint(event)],
    ];
  }

  drawModalSignature(event: PointerEvent): void {
    if (!this.isDrawingSignature) {
      return;
    }

    const point = this.svgPoint(event);
    const strokes = this.activeSignatureDrawing.strokes.map((stroke, index) =>
      index === this.activeSignatureDrawing.strokes.length - 1 ? [...stroke, point] : stroke,
    );
    this.activeSignatureDrawing = { ...this.activeSignatureDrawing, strokes };
  }

  endModalSignature(): void {
    this.isDrawingSignature = false;
  }

  clearActiveSignature(): void {
    if (this.activeSignatureFieldName) {
      delete this.signatureDrawings[this.activeSignatureFieldName];
    }
    this.closeSignatureDialog();
  }

  acceptSignature(): void {
    if (!this.activeSignatureFieldName) {
      return;
    }

    const cropped = this.activeSignatureMode === 'type'
      ? typedDrawing(this.activeSignatureText, this.activeSignatureFontFamily)
      : cropDrawing(this.activeSignatureDrawing);
    if (!cropped) {
      this.clearActiveSignature();
      return;
    }

    this.signatureDrawings = {
      ...this.signatureDrawings,
      [this.activeSignatureFieldName]: cropped,
    };
    this.closeSignatureDialog();
  }

  setToday(fieldName: string): void {
    this.textValues = {
      ...this.textValues,
      [fieldName]: this.dateValueFormatter(new Date()),
    };
  }

  async save(): Promise<DocumentSignerCompletedEvent> {
    const texts: DocumentSignerTextValue[] = this.fields
      .filter((field) => field.type === 'text' || field.type === 'date')
      .map((field) => ({
        fieldName: field.name,
        value: field.type === 'date'
          ? this.datePdfValueFormatter(this.textValues[field.name] ?? '')
          : this.textValues[field.name] ?? '',
      }));
    const signatures = await Promise.all(this.fields
      .filter((field) => field.type === 'signature')
      .filter((field) => this.signatureDrawings[field.name])
      .map(async (field): Promise<DocumentSignerSignatureValue> => ({
        fieldName: field.name,
        dataUrl: await drawingToPng(this.signatureDrawings[field.name]),
      })));
    const bytes = await this.signer.fillPdf(this.source, texts, signatures, { partialFlatten: this.partialFlattenOnSave });
    const event = { bytes, blob: this.signer.createBlob(bytes) };
    this.completed.emit(event);
    return event;
  }

  async download(filename = 'signed-form.pdf'): Promise<void> {
    const event = await this.save();
    downloadBlob(event.blob, filename);
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

  viewBox(drawing: SignatureDrawing | undefined): string {
    const width = drawing?.width ?? 1;
    const height = drawing?.height ?? 1;
    return `0 0 ${width} ${height}`;
  }

  paths(drawing: SignatureDrawing | undefined): string[] {
    return drawing?.strokes.map(strokeToPath) ?? [];
  }

  typedSignature(drawing: SignatureDrawing | undefined): SignatureText | undefined {
    return drawing?.text;
  }

  typedSignaturePreview(): SignatureDrawing {
    return typedDrawing(this.activeSignatureText, this.activeSignatureFontFamily) ?? emptyTypedDrawing(this.activeSignatureFontFamily);
  }

  buttonClasses(button: SignerButtonName): DocumentSignerClassValue[] {
    const specific = this.buttonClassFor(button);
    const classes: DocumentSignerClassValue[] = [];
    if (this.buttonClass) classes.push(this.buttonClass);
    if (specific) classes.push(specific);
    if ((button === 'save' || button === 'acceptSignature') && this.primaryButtonClass) classes.push(this.primaryButtonClass);
    return classes;
  }

  buttonStyles(button: SignerButtonName): DocumentSignerStyleValue {
    return {
      ...this.buttonStyle,
      ...this.buttonStyleFor(button),
      ...(button === 'save' || button === 'acceptSignature' ? this.primaryButtonStyle : undefined),
    };
  }

  private buttonClassFor(button: SignerButtonName): DocumentSignerClassValue | undefined {
    return {
      previous: this.previousPageButtonClass,
      next: this.nextPageButtonClass,
      zoomOut: this.zoomOutButtonClass,
      zoomIn: this.zoomInButtonClass,
      save: this.saveButtonClass,
      acceptSignature: this.acceptSignatureButtonClass,
      clearSignature: this.clearSignatureButtonClass,
      today: this.todayButtonClass,
      signatureModeDraw: undefined,
      signatureModeType: undefined,
    }[button];
  }

  private buttonStyleFor(button: SignerButtonName): DocumentSignerStyleValue | undefined {
    return {
      previous: this.previousPageButtonStyle,
      next: this.nextPageButtonStyle,
      zoomOut: this.zoomOutButtonStyle,
      zoomIn: this.zoomInButtonStyle,
      save: this.saveButtonStyle,
      acceptSignature: this.acceptSignatureButtonStyle,
      clearSignature: this.clearSignatureButtonStyle,
      today: this.todayButtonStyle,
      signatureModeDraw: undefined,
      signatureModeType: undefined,
    }[button];
  }

  private async open(): Promise<void> {
    if (!this.source) {
      return;
    }
    this.document = await loadPdfDocument(this.source, this.workerSrc);
    this.fields = await this.signer.extractFields(this.source);
    this.textValues = Object.fromEntries(this.fields.filter((field) => field.type === 'text' || field.type === 'date').map((field) => [field.name, field.value ?? '']));
    this.signatureDrawings = {};
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

  private resizeActiveDrawing(): void {
    const svg = this.modalSignatureSvg?.nativeElement;
    if (!svg || this.activeSignatureDrawing.strokes.length > 0) {
      return;
    }

    const bounds = svg.getBoundingClientRect();
    this.activeSignatureDrawing = {
      width: Math.max(1, Math.floor(bounds.width)),
      height: Math.max(1, Math.floor(bounds.height)),
      strokes: [],
    };
  }

  private svgPoint(event: PointerEvent): SignaturePoint {
    const svg = this.modalSignatureSvg?.nativeElement;
    if (!svg) {
      return { x: 0, y: 0 };
    }

    const bounds = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) * this.activeSignatureDrawing.width) / bounds.width,
      y: ((event.clientY - bounds.top) * this.activeSignatureDrawing.height) / bounds.height,
    };
  }
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SignaturePoint {
  x: number;
  y: number;
}

interface SignatureDrawing {
  width: number;
  height: number;
  strokes: SignaturePoint[][];
  text?: SignatureText;
}

interface SignatureText {
  value: string;
  fontFamily: string;
  fontSize: number;
  x: number;
  y: number;
  textAnchor: 'middle';
  dominantBaseline: 'middle';
  textLength: number;
}

type SignatureMode = 'draw' | 'type';

function emptyDrawing(): SignatureDrawing {
  return { width: 900, height: 360, strokes: [] };
}

function emptyTypedDrawing(fontFamily: string): SignatureDrawing {
  return {
    width: 900,
    height: 360,
    strokes: [],
    text: {
      value: '',
      fontFamily,
      fontSize: 140,
      x: 450,
      y: 190,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      textLength: 720,
    },
  };
}

function cloneDrawing(drawing: SignatureDrawing): SignatureDrawing {
  return {
    width: drawing.width,
    height: drawing.height,
    strokes: drawing.strokes.map((stroke) => stroke.map((point) => ({ ...point }))),
    text: drawing.text ? { ...drawing.text } : undefined,
  };
}

function strokeToPath(stroke: SignaturePoint[]): string {
  if (stroke.length === 0) {
    return '';
  }

  if (stroke.length === 1) {
    const point = stroke[0];
    return `M ${point.x} ${point.y} l 0.01 0`;
  }

  return stroke.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function cropDrawing(drawing: SignatureDrawing): SignatureDrawing | undefined {
  const points = drawing.strokes.flat();
  if (points.length === 0) {
    return undefined;
  }

  const padding = 12;
  const minX = Math.max(0, Math.min(...points.map((point) => point.x)) - padding);
  const minY = Math.max(0, Math.min(...points.map((point) => point.y)) - padding);
  const maxX = Math.min(drawing.width, Math.max(...points.map((point) => point.x)) + padding);
  const maxY = Math.min(drawing.height, Math.max(...points.map((point) => point.y)) + padding);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return {
    width,
    height,
    strokes: drawing.strokes.map((stroke) => stroke.map((point) => ({ x: point.x - minX, y: point.y - minY }))),
  };
}

function typedDrawing(value: string, fontFamily: string): SignatureDrawing | undefined {
  const text = value.trim();
  if (!text) {
    return undefined;
  }

  const drawing = emptyTypedDrawing(fontFamily);
  drawing.text = {
    ...drawing.text!,
    value: text,
    textLength: Math.min(780, Math.max(260, text.length * 42)),
  };
  return drawing;
}

async function drawingToPng(drawing: SignatureDrawing): Promise<string> {
  const width = 1800;
  const height = Math.max(1, Math.round((drawing.height / drawing.width) * width));
  const paths = drawing.strokes.map((stroke) => `<path d="${strokeToPath(stroke)}" />`).join('');
  const text = drawing.text
    ? `<text x="${drawing.text.x}" y="${drawing.text.y}" font-family="${escapeXml(drawing.text.fontFamily)}" font-size="${drawing.text.fontSize}" text-anchor="${drawing.text.textAnchor}" dominant-baseline="${drawing.text.dominantBaseline}" textLength="${drawing.text.textLength}" lengthAdjust="spacingAndGlyphs">${escapeXml(drawing.text.value)}</text>`
    : '';
  const strokeWidth = Math.max(4, Math.min(7, Math.min(drawing.width, drawing.height) * 0.055));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${drawing.width} ${drawing.height}" width="${width}" height="${height}"><g fill="#000">${text}</g><g fill="none" stroke="#000" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));

  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to render signature image.'));
    image.src = url;
  });
}

type SignerButtonName = 'previous' | 'next' | 'zoomOut' | 'zoomIn' | 'save' | 'today' | 'acceptSignature' | 'clearSignature' | 'signatureModeDraw' | 'signatureModeType';

function defaultSignatureFontOptions(): DocumentSignerSignatureFontOption[] {
  return [
    { label: 'Cursive', value: 'Brush Script MT, Segoe Script, cursive' },
    { label: 'Serif', value: 'Georgia, Times New Roman, serif' },
    { label: 'Classic', value: 'Times New Roman, serif' },
    { label: 'Clean', value: 'Arial, sans-serif' },
  ];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function defaultDateValueFormatter(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function defaultDatePdfValueFormatter(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? match[2] + '/' + match[3] + '/' + match[1] : value;
}

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

function defaultPreviewZoom(): number {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches ? 1.8 : 1;
}
