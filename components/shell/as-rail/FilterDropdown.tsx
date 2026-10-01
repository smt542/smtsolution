"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/common";

export interface DdOption {
  value: string;
  label: string;
  sub?: string;
  code?: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: DdOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  ariaLabel: string;
}

interface MultiFilterDropdownProps {
  label: string;
  values: string[];
  options: DdOption[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
}

const CTL_BASE =
  "flex items-center justify-between cursor-pointer h-[30px] px-[10px] text-[12px] font-bold text-t2 bg-white border rounded-[8px] gap-1.5 whitespace-nowrap";
const MENU_BASE =
  "absolute top-[calc(100%+5px)] bg-white border border-line rounded-[12px] shadow-[0_14px_34px_-10px_rgba(23,31,40,0.28)] z-[90] max-h-[240px] w-max min-w-[110px]";
const OPT_BASE =
  "py-[9px] px-[11px] rounded-[8px] text-[13px] cursor-pointer whitespace-nowrap hover:bg-bg";

function useOutsideClose(
  ref: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose, ref]);
}

function Chevron({ open = false }: { open?: boolean }) {
  return (
    <svg
      className={`transition-all duration-[150ms] flex-none ${open ? "rotate-180" : ""}`}
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8B95A1"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function onKeyboardActivate(event: React.KeyboardEvent, activate: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  searchable = false,
  ariaLabel,
}: FilterDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useOutsideClose(rootRef, () => setOpen(false));

  const isSort = ariaLabel.includes("정렬");
  const selected = options.find((option) => option.value === value);
  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      [option.label, option.sub, option.code]
        .filter(Boolean)
        .some((part) => part!.toLocaleLowerCase().includes(normalized)),
    );
  }, [options, query]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  // .asfBld .ddMenu → overflow-hidden p-0 (searchable); otherwise base overflow-auto p-1.5
  // .asfDd[data-f="sort"] .ddMenu → left-auto right-0; otherwise .asfDd → left-0 right-auto
  const menuClass = `${MENU_BASE} ${
    searchable ? "overflow-hidden p-0" : "overflow-auto p-1.5"
  } ${isSort ? "left-auto right-0" : "left-0 right-auto"} ${open ? "block" : "hidden"}`;

  return (
    <div
      ref={rootRef}
      className="relative flex-[0_1_auto]"
      data-f={isSort ? "sort" : undefined}
      data-value={value}
    >
      <div
        className={`${CTL_BASE} ${open ? "border-blue" : "border-line"}`}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) =>
          onKeyboardActivate(event, () => setOpen((current) => !current))
        }
      >
        <span className="dd-val">
          {value ? selected?.label ?? label : label}
        </span>
        <Chevron open={open} />
      </div>
      <div className={menuClass} role="listbox" aria-label={ariaLabel}>
        {searchable && (
          <div className="relative bg-white p-2.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8B95A1"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="w-[15px] h-[15px] absolute left-[21px] top-1/2 -translate-y-1/2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
            <Input
              unstyled
              className="w-full h-[36px] border border-line rounded-[10px] pl-8 pr-[11px] text-[12.5px] font-medium text-t1 outline-none bg-white focus:border-blue"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="건물명·주소 검색"
              aria-label="건물명·주소 검색"
            />
          </div>
        )}
        {searchable ? (
          <div className="max-h-[232px] overflow-auto py-1">
            {visibleOptions.map((option) => (
              <div
                key={option.value}
                className={`${OPT_BASE} flex items-start gap-2.5 ${
                  option.value === value
                    ? "text-blue font-bold bg-blue-t"
                    : "text-t2 font-semibold"
                }`}
                role="option"
                tabIndex={0}
                aria-selected={option.value === value}
                onClick={() => select(option.value)}
                onKeyDown={(event) =>
                  onKeyboardActivate(event, () => select(option.value))
                }
              >
                <span className="flex-none w-[26px] text-[11.5px] font-bold text-t3 pt-px">
                  {option.code ?? ""}
                </span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <b className="text-[13px] font-bold text-t1 whitespace-nowrap overflow-hidden text-ellipsis">
                    {option.label}
                  </b>
                  {option.sub && (
                    <i className="not-italic text-[11.5px] font-medium text-t3 whitespace-nowrap overflow-hidden text-ellipsis">
                      {option.sub}
                    </i>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          visibleOptions.map((option) => (
            <div
              key={option.value}
              className={`${OPT_BASE} ${
                option.value === value
                  ? "text-blue font-bold bg-blue-t"
                  : "text-t2 font-semibold"
              }`}
              role="option"
              tabIndex={0}
              aria-selected={option.value === value}
              onClick={() => select(option.value)}
              onKeyDown={(event) =>
                onKeyboardActivate(event, () => select(option.value))
              }
            >
              {option.label}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function MultiFilterDropdown({
  label,
  values,
  options,
  onChange,
  ariaLabel,
}: MultiFilterDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useOutsideClose(rootRef, () => setOpen(false));

  const selectableOptions = options.filter((option) => option.value !== "");
  const selectedOptions = selectableOptions.filter((option) =>
    values.includes(option.value),
  );
  const allSelected =
    selectableOptions.length > 0 &&
    selectableOptions.every((option) => values.includes(option.value));
  const valueLabel = selectedOptions.length
    ? `${selectedOptions[0].label}${selectedOptions.length > 1 ? ` 외 ${selectedOptions.length - 1}` : ""}`
    : label;

  const toggleValue = (option: DdOption) => {
    if (option.value === "") {
      onChange(allSelected ? [] : selectableOptions.map((item) => item.value));
      return;
    }
    onChange(
      values.includes(option.value)
        ? values.filter((value) => value !== option.value)
        : [...values, option.value],
    );
  };

  return (
    <div
      ref={rootRef}
      className="relative flex-[0_1_auto]"
      data-value={values.join(",")}
    >
      <div
        className={`${CTL_BASE} ${open ? "border-blue" : "border-line"}`}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) =>
          onKeyboardActivate(event, () => setOpen((current) => !current))
        }
      >
        <span className="dd-val">{valueLabel}</span>
        <Chevron open={open} />
      </div>
      <div
        className={`${MENU_BASE} overflow-auto p-1.5 left-0 right-auto ${open ? "block" : "hidden"}`}
        role="listbox"
        aria-label={ariaLabel}
        aria-multiselectable="true"
      >
        {options.map((option) => {
          const active = option.value === "" ? allSelected : values.includes(option.value);
          return (
            <div
              key={option.value}
              className={`${OPT_BASE} flex items-center gap-[9px] relative font-semibold text-t2 before:content-[''] before:w-[19px] before:h-[19px] before:rounded-md before:border-2 before:flex-none before:box-border before:transition-all before:duration-100 ${
                active
                  ? "before:border-blue before:bg-blue after:content-[''] after:absolute after:left-[20.5px] after:top-1/2 after:w-[5px] after:h-[9px] after:border-solid after:border-white after:border-r-2 after:border-b-2 after:[transform:translate(-50%,-60%)_rotate(45deg)]"
                  : "before:border-line"
              }`}
              role="option"
              tabIndex={0}
              aria-selected={active}
              onClick={() => toggleValue(option)}
              onKeyDown={(event) =>
                onKeyboardActivate(event, () => toggleValue(option))
              }
            >
              {option.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
