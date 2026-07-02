import { useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./supabaseClient";

type AuthWidgetProps = {
  authError: string | null;
  authMessage: string | null;
  isAuthLoading: boolean;
  isAutoSyncing: boolean;
  isCloudReady: boolean;
  isCloudUploadLoading: boolean;
  user: User | null;
  variant?: "widget" | "screen";
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onDownloadCloudData: () => Promise<void>;
  onSaveLocalChanges: () => Promise<void>;
  onUploadLocalData: () => Promise<void>;
};

export function AuthWidget({
  authError,
  authMessage,
  isAuthLoading,
  isAutoSyncing,
  isCloudReady,
  user,
  variant = "widget",
  onSignIn,
  onSignOut,
  onSignUp,
}: AuthWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "sign-in") {
      await onSignIn(email, password);
      return;
    }

    await onSignUp(email, password);
  }

  const form = (
    <form className="auth-widget__form" onSubmit={handleSubmit}>
      <div className="auth-widget__tabs" role="tablist" aria-label="Rezim">
        <button
          type="button"
          data-active={mode === "sign-in" ? "true" : "false"}
          onClick={() => setMode("sign-in")}
        >
          Prihlasit
        </button>
        <button
          type="button"
          data-active={mode === "sign-up" ? "true" : "false"}
          onClick={() => setMode("sign-up")}
        >
          Registrovat
        </button>
      </div>
      <label>
        <span>E-mail</span>
        <input
          autoComplete="email"
          inputMode="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
        />
      </label>
      <label>
        <span>Heslo</span>
        <input
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          minLength={6}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          required
        />
      </label>
      <button type="submit" disabled={isAuthLoading}>
        {isAuthLoading
          ? "Pracuji..."
          : mode === "sign-in"
            ? "Prihlasit se"
            : "Vytvorit ucet"}
      </button>
    </form>
  );

  const messages = (
    <>
      {authMessage ? (
        <p className="auth-widget__message" data-tone="success">
          {authMessage}
        </p>
      ) : null}
      {authError ? (
        <p className="auth-widget__message" data-tone="danger">
          {authError}
        </p>
      ) : null}
    </>
  );

  if (variant === "screen") {
    return (
      <main className="auth-screen" aria-label="Prihlaseni do DoNext">
        <section className="auth-screen__hero">
          <div className="auth-screen__brand">
            <span aria-hidden="true">Do</span>
            <strong>DoNext</strong>
          </div>
          <div className="auth-screen__copy">
            <span>Osobni i tymove ukoly</span>
            <h1>Jeden ucet. Vsechny ukoly pod kontrolou.</h1>
            <p>
              Prihlas se a DoNext ti nacte osobni prostor, tymy, pozvanky i sync
              mezi webem a Androidem.
            </p>
          </div>
          <div className="auth-screen__points" aria-label="Co ziskas">
            <span>Automaticky sync</span>
            <span>Team work</span>
            <span>Focus asistent</span>
          </div>
        </section>

        <section
          className="auth-screen__card"
          aria-labelledby="auth-screen-title"
        >
          <div className="auth-widget__header auth-screen__header">
            <div>
              <strong id="auth-screen-title">
                {mode === "sign-in" ? "Vitej zpet" : "Vytvor ucet"}
              </strong>
              <span>
                {mode === "sign-in"
                  ? "Pokracuj do sveho osobniho a tymoveho prostoru."
                  : "Po registraci potvrdis e-mail a muzes prijimat tymove pozvanky."}
              </span>
            </div>
          </div>

          {!isSupabaseConfigured ? (
            <p className="auth-widget__message" data-tone="danger">
              Supabase neni nakonfigurovany.
            </p>
          ) : (
            form
          )}

          {messages}
        </section>
      </main>
    );
  }

  return (
    <>
      <button
        className="auth-widget__trigger"
        data-signed-in={user ? "true" : "false"}
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <span className="auth-widget__dot" aria-hidden="true" />
        <span>
          {user
            ? isAutoSyncing
              ? "Sync uklada"
              : isCloudReady
                ? "Sync zapnuty"
                : "Sync nacita"
            : "Prihlasit"}
        </span>
      </button>
      {isOpen ? (
        <div className="auth-widget" role="presentation">
          <button
            className="auth-widget__backdrop"
            aria-label="Zavrit prihlaseni"
            type="button"
            onClick={() => setIsOpen(false)}
          />
          <section
            className="auth-widget__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-widget-title"
          >
            <div className="auth-widget__header">
              <div>
                <strong id="auth-widget-title">Ucet a sync</strong>
                <span>
                  {user
                    ? user.email
                    : "Prihlaseni je pripravene pro synchronizaci a tymy."}
                </span>
                {user ? (
                  <span>
                    {isAutoSyncing
                      ? "Automaticky ukladam zmeny."
                      : isCloudReady
                        ? "Automaticky nacitam i ukladam zmeny."
                        : "Nacitam cloudova data."}
                  </span>
                ) : null}
              </div>
              <button
                aria-label="Zavrit"
                className="auth-widget__close"
                type="button"
                onClick={() => setIsOpen(false)}
              >
                x
              </button>
            </div>

            {!isSupabaseConfigured ? (
              <p className="auth-widget__message" data-tone="danger">
                Supabase neni nakonfigurovany.
              </p>
            ) : user ? (
              <div className="auth-widget__signed-in">
                <p>
                  Sync bezi automaticky. Zmeny se ukladaji na pozadi a po
                  prihlaseni se data sama nactou z cloudu.
                </p>
                <button type="button" onClick={onSignOut} disabled={isAuthLoading}>
                  Odhlasit
                </button>
              </div>
            ) : (
              form
            )}

            {messages}
          </section>
        </div>
      ) : null}
    </>
  );
}
