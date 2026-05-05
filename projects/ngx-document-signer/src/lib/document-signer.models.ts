export type DocumentSignerSource = string | ArrayBuffer | Uint8Array | Blob;

export type DocumentSignerFieldType = 'text' | 'signature';

export interface DocumentSignerField {
  id: string;
  name: string;
  type: DocumentSignerFieldType;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value?: string;
}

export interface DocumentSignerSaveEvent {
  bytes: Uint8Array;
  blob: Blob;
  fields: DocumentSignerField[];
}

export interface DocumentSignerCompletedEvent {
  bytes: Uint8Array;
  blob: Blob;
}

export interface DocumentSignerSignatureValue {
  fieldName: string;
  dataUrl: string;
}

export interface DocumentSignerTextValue {
  fieldName: string;
  value: string;
}

export type DocumentSignerClassValue = string | string[] | Set<string> | { [klass: string]: unknown };

export type DocumentSignerStyleValue = { [klass: string]: unknown };
