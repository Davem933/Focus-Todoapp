import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

type AnimatedCheckboxProps = {
  checked: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "md" | "sm";
};

const CHECK_PATH = "M4 8.5L6.8 11.3L12 5.2";

export function AnimatedCheckbox({
  checked,
  ariaLabel,
  onChange,
  disabled = false,
  size = "md",
}: AnimatedCheckboxProps) {
  const prefersReducedMotion = useReducedMotion();
  const inputId = useId();

  return (
    <span
      className="animated-checkbox"
      data-checked={checked}
      data-disabled={disabled}
      data-size={size}
    >
      <input
        aria-label={ariaLabel}
        checked={checked}
        className="animated-checkbox__input"
        disabled={disabled}
        id={inputId}
        type="checkbox"
        onChange={(event) => onChange(event.currentTarget.checked)}
        onClick={(event) => event.stopPropagation()}
      />
      <label className="animated-checkbox__box" htmlFor={inputId} aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <motion.path
            className="animated-checkbox__check"
            d={CHECK_PATH}
            initial={false}
            animate={{
              pathLength: checked ? 1 : 0,
              opacity: checked ? 1 : 0,
            }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
            }
          />
        </svg>
      </label>
    </span>
  );
}
