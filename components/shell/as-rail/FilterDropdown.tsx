"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./AsRail.module.css";

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

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

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

function Chevron() {
  return (
    <svg
      className={styles.ddCv}
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

  return (
    <div
      ref={rootRef}
      className={classNames(
        styles.dd,
        styles.asfDd,
        searchable && styles.asfBld,
        open && styles.open,
      )}
      data-f={ariaLabel.includes("정렬") ? "sort" : undefined}
      data-value={value}
    >
      <div
        className={styles.ddCtl}
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
        <Chevron />
      </div>
      <div className={styles.ddMenu} role="listbox" aria-label={ariaLabel}>
        {searchable && (
          <div className={styles.asfSrch}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8B95A1"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
            <input
              className={styles.asfQ}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="건물명·주소 검색"
              aria-label="건물명·주소 검색"
            />
          </div>
        )}
        {searchable ? (
          <div className={styles.asfOpts}>
            {visibleOptions.map((option) => (
              <div
                key={option.value}
                className={classNames(
                  styles.ddOpt,
                  styles.asfO,
                  option.value === value && styles.on,
                )}
                role="option"
                tabIndex={0}
                aria-selected={option.value === value}
                onClick={() => select(option.value)}
                onKeyDown={(event) =>
                  onKeyboardActivate(event, () => select(option.value))
                }
              >
                <span className={styles.asfCode}>{option.code ?? ""}</span>
                <span className={styles.asfTxt}>
                  <b>{option.label}</b>
                  {option.sub && <i>{option.sub}</i>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          visibleOptions.map((option) => (
            <div
              key={option.value}
              className={classNames(
                styles.ddOpt,
                option.value === value && styles.on,
              )}
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
      className={classNames(
        styles.dd,
        styles.asfDd,
        styles.multi,
        open && styles.open,
      )}
      data-value={values.join(",")}
    >
      <div
        className={styles.ddCtl}
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
        <Chevron />
      </div>
      <div
        className={styles.ddMenu}
        role="listbox"
        aria-label={ariaLabel}
        aria-multiselectable="true"
      >
        {options.map((option) => {
          const active = option.value === "" ? allSelected : values.includes(option.value);
          return (
            <div
              key={option.value}
              className={classNames(styles.ddOpt, active && styles.on)}
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
