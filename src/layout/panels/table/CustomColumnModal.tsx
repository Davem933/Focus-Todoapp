import { useState } from "react";
import type { CustomFieldOption, CustomFieldType } from "../../../tasks/customFieldTypes";

type CustomColumnModalProps = {
  onClose: () => void;
  onSubmit: (title: string, fieldType: CustomFieldType, options: CustomFieldOption[]) => void;
};

export function CustomColumnModal({ onClose, onSubmit }: CustomColumnModalProps) {
  const [title, setTitle] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [optionsInput, setOptionsInput] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return;
    }

    const options: CustomFieldOption[] =
      fieldType === "select"
        ? optionsInput
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((label) => ({ value: label.toLowerCase().replace(/\s+/g, "-"), label }))
        : [];

    onSubmit(trimmedTitle, fieldType, options);
  }

  return (
    <div className="custom-column-modal__backdrop" onClick={onClose}>
      <form
        className="custom-column-modal__panel"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2>Novy sloupec</h2>
        <label className="custom-column-modal__field">
          <span>Nazev</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            autoFocus
            required
          />
        </label>
        <label className="custom-column-modal__field">
          <span>Typ</span>
          <select
            value={fieldType}
            onChange={(event) => setFieldType(event.currentTarget.value as CustomFieldType)}
          >
            <option value="text">Text</option>
            <option value="select">Vyber z moznosti</option>
          </select>
        </label>
        {fieldType === "select" ? (
          <label className="custom-column-modal__field">
            <span>Moznosti (oddelene carkou)</span>
            <input
              type="text"
              value={optionsInput}
              onChange={(event) => setOptionsInput(event.currentTarget.value)}
              placeholder="napr. Nizka, Stredni, Vysoka"
            />
          </label>
        ) : null}
        <div className="custom-column-modal__actions">
          <button type="button" onClick={onClose}>
            Zrusit
          </button>
          <button type="submit" disabled={!title.trim()}>
            Pridat sloupec
          </button>
        </div>
      </form>
    </div>
  );
}
