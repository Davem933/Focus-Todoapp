import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { MouseEvent } from "react";

export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type CustomDropdownProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  renderTriggerContent?: (selectedOption: DropdownOption | null) => React.ReactNode;
  renderOptionContent?: (option: DropdownOption) => React.ReactNode;
};

export function CustomDropdown({
  value,
  options,
  onChange,
  placeholder = "Vyberte",
  ariaLabel,
  disabled = false,
  className,
  renderTriggerContent,
  renderOptionContent,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption =
    options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | globalThis.MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={className ? `custom-dropdown ${className}` : "custom-dropdown"}
      data-open={isOpen ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
    >
      <button
        className="custom-dropdown__trigger"
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        {renderTriggerContent ? (
          renderTriggerContent(selectedOption)
        ) : (
          <span className="custom-dropdown__value">
            {selectedOption?.label ?? placeholder}
          </span>
        )}
        <span className="custom-dropdown__chevron" aria-hidden="true">
          <ChevronDown size={16} strokeWidth={2} />
        </span>
      </button>
      {isOpen ? (
        <div className="custom-dropdown__menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                className="custom-dropdown__option"
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                data-selected={isSelected ? "true" : "false"}
                onClick={() => {
                  if (option.disabled) {
                    return;
                  }

                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {renderOptionContent ? (
                  renderOptionContent(option)
                ) : (
                  <span>{option.label}</span>
                )}
                {isSelected ? (
                  <span className="custom-dropdown__option-check" aria-hidden="true">
                    <Check size={14} strokeWidth={2.4} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
