"use client";
import { TextField } from "./TextField";
import { SelectField } from "./SelectField";
import { DateField } from "./DateField";
import type { FieldDef } from "../config/types";

/** Maps a config-driven FieldDef to the matching Figma primitive. */
export function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const common = {
    label: field.label,
    placeholder: field.placeholder,
    value,
    onChange,
    full: field.full,
  };
  switch (field.kind) {
    case "select":
      return <SelectField {...common} options={field.options ?? []} />;
    case "date":
      return <DateField {...common} />;
    case "readonly":
      return <TextField {...common} readOnly />;
    default:
      return <TextField {...common} />;
  }
}
