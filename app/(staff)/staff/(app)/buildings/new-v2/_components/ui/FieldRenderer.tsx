"use client";
import { TextField } from "./TextField";
import { SelectField } from "./SelectField";
import { DateField } from "./DateField";
import { TextAreaField } from "./TextAreaField";
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
    value: value || field.defaultValue,
    onChange,
    full: field.full,
  };
  switch (field.kind) {
    case "select":
      return <SelectField {...common} options={field.options ?? []} />;
    case "date":
      return <DateField {...common} />;
    case "textarea":
      return <TextAreaField {...common} minHeight={field.minHeight} />;
    case "phone":
      return <TextField {...common} format="phone" />;
    case "readonly":
      return <TextField {...common} readOnly />;
    default:
      return <TextField {...common} />;
  }
}
