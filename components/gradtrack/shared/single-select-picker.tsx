"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type SelectPickerOption = {
  value: string;
  label: string;
};

export function SingleSelectPicker({
  ariaLabel,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}: {
  ariaLabel: string;
  value: string;
  options: SelectPickerOption[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return <div className="relative" ref={pickerRef}>
    <button aria-controls={listboxId} aria-expanded={isOpen} aria-haspopup="listbox" aria-label={ariaLabel} className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-slate-800 transition-colors hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} type="button" onClick={() => setIsOpen((open) => !open)}>
      <span className={selectedOption ? "min-w-0 flex-1 truncate text-sm" : "min-w-0 flex-1 text-sm text-slate-500"}>{selectedOption?.label || placeholder}</span>
      <ChevronDown aria-hidden="true" className={`shrink-0 text-slate-500 transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} size={16} />
    </button>
    {isOpen ? <div className="absolute left-0 z-20 mt-1 w-full min-w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg" id={listboxId} role="listbox" aria-label={ariaLabel}>
      <div className="max-h-52 overflow-y-auto">
        {options.map((option) => <button aria-selected={option.value === value} className={`flex w-full items-center rounded-md px-2 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${option.value === value ? "bg-blue-100 font-medium text-blue-950" : "text-slate-700 hover:bg-blue-50"}`} key={option.value} role="option" type="button" onClick={() => { onChange(option.value); setIsOpen(false); }}>{option.label}</button>)}
      </div>
    </div> : null}
  </div>;
}
