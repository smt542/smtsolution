export type FieldKind = "text" | "textarea" | "readonly" | "select" | "date";

export interface FieldDef {
  label: string;
  kind: FieldKind;
  placeholder?: string;
  options?: string[];
  full?: boolean;
  defaultValue?: string;
  minHeight?: number;
}
