export type FieldKind = "text" | "readonly" | "select" | "date";

export interface FieldDef {
  label: string;
  kind: FieldKind;
  placeholder?: string;
  options?: string[];
  full?: boolean;
}
