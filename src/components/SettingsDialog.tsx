import { useEffect, useId, useRef, useState } from "react";
import { PRESETS, type Credentials } from "../credentials.ts";

type SettingsDialogProps = {
  open: boolean;
  credentials: Credentials;
  onClose: () => void;
  onSave: (credentials: Credentials) => void;
  onForget: () => void;
};

export function SettingsDialog({
  open,
  credentials,
  onClose,
  onSave,
  onForget,
}: SettingsDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(credentials);

  useEffect(() => {
    if (open) setDraft(credentials);
  }, [open, credentials]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onClose={onClose}>
      <form
        className="settings"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <header>
          <p className="eyebrow">Optional</p>
          <h2 id={titleId}>Score with a model</h2>
          <p>
            Offline ranking runs in this browser and needs no key. A saved key is sent only to
            this app’s <code>/api/analyze</code> route, which forwards it to the provider you
            pick. Nothing is stored on the server.
          </p>
        </header>
        <label>
          Provider
          <select
            value={PRESETS.some((preset) => preset.id === draft.preset) ? draft.preset : "custom"}
            onChange={(event) => {
              const preset = PRESETS.find((item) => item.id === event.target.value);
              if (!preset) {
                setDraft({ ...draft, preset: "custom" });
                return;
              }
              setDraft({
                ...draft,
                preset: preset.id,
                baseUrl: preset.baseUrl,
                model: preset.model,
              });
            }}
          >
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          Base URL
          <input
            value={draft.baseUrl}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) =>
              setDraft({ ...draft, preset: "custom", baseUrl: event.target.value })
            }
          />
        </label>
        <label>
          Model
          <input
            value={draft.model}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) =>
              setDraft({ ...draft, preset: "custom", model: event.target.value })
            }
          />
        </label>
        <label>
          API key
          <input
            type="password"
            value={draft.apiKey}
            autoComplete="off"
            spellCheck={false}
            placeholder="Kept in this browser after you save"
            onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
          />
        </label>
        <div className="settings-actions">
          <button type="submit" className="primary">
            Save and use model
          </button>
          <button type="button" className="ghost" onClick={onForget}>
            Forget key
          </button>
          <button type="button" className="text" onClick={onClose}>
            Close
          </button>
        </div>
      </form>
    </dialog>
  );
}
