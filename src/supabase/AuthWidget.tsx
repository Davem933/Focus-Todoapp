import { useState } from "react";
import type { FormEvent, MouseEvent as ReactMouseEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { ArrowRight, Eye, EyeClosed, Lock, Mail } from "lucide-react";
import { isSupabaseConfigured } from "./supabaseClient";

type AuthScreenFocusField = "email" | "password" | null;

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
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<AuthScreenFocusField>(null);

  const cardMouseX = useMotionValue(0);
  const cardMouseY = useMotionValue(0);
  const cardRotateX = useTransform(cardMouseY, [-300, 300], [10, -10]);
  const cardRotateY = useTransform(cardMouseX, [-300, 300], [-10, 10]);

  function handleCardMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    cardMouseX.set(event.clientX - rect.left - rect.width / 2);
    cardMouseY.set(event.clientY - rect.top - rect.height / 2);
  }

  function handleCardMouseLeave() {
    cardMouseX.set(0);
    cardMouseY.set(0);
  }

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
      <div className="auth-widget__tabs" role="tablist" aria-label="Režim">
        <button
          type="button"
          data-active={mode === "sign-in" ? "true" : "false"}
          onClick={() => setMode("sign-in")}
        >
          Přihlásit
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
            ? "Přihlásit se"
            : "Vytvořit účet"}
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
      <main className="auth-screen" aria-label="Přihlášení do DoNext">
        <div className="auth-screen__glow auth-screen__glow--top" aria-hidden="true" />
        <div className="auth-screen__glow auth-screen__glow--bottom" aria-hidden="true" />
        <div className="auth-screen__noise" aria-hidden="true" />

        <section className="auth-screen__hero">
          <div className="auth-screen__brand">
            <span aria-hidden="true">Do</span>
            <strong>DoNext</strong>
          </div>
          <div className="auth-screen__copy">
            <span>Osobní i týmové úkoly</span>
            <h1>Jeden účet. Všechny úkoly pod kontrolou.</h1>
            <p>
              Přihlas se a DoNext ti načte osobní prostor, týmy, pozvánky i sync
              mezi webem a Androidem.
            </p>
          </div>
          <div className="auth-screen__points" aria-label="Co získáš">
            <span>Automatický sync</span>
            <span>Team work</span>
            <span>Focus asistent</span>
          </div>
        </section>

        <motion.div
          className="auth-screen-card-wrap"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style={{ perspective: 1500 }}
        >
          <motion.div
            className="auth-screen-card-tilt"
            style={{ rotateX: cardRotateX, rotateY: cardRotateY }}
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
          >
            <div className="auth-screen-card">
              <motion.div
                className="auth-screen-card__outer-glow"
                aria-hidden="true"
                animate={{
                  boxShadow: [
                    "0 0 14px 3px rgba(139, 92, 246, 0.18)",
                    "0 0 26px 7px rgba(139, 92, 246, 0.32)",
                    "0 0 14px 3px rgba(139, 92, 246, 0.18)",
                  ],
                  opacity: [0.5, 0.85, 0.5],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }}
              />

              <div className="auth-screen-card__border-glow" aria-hidden="true" />

              <div className="auth-screen-card__beams" aria-hidden="true">
                <motion.div
                  className="auth-screen-card__beam auth-screen-card__beam--top"
                  animate={{
                    left: ["-50%", "100%"],
                    opacity: [0.3, 0.7, 0.3],
                  }}
                  transition={{
                    left: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 },
                    opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror" },
                  }}
                />
                <motion.div
                  className="auth-screen-card__beam auth-screen-card__beam--right"
                  animate={{
                    top: ["-50%", "100%"],
                    opacity: [0.3, 0.7, 0.3],
                  }}
                  transition={{
                    top: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 0.6 },
                    opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 0.6 },
                  }}
                />
                <motion.div
                  className="auth-screen-card__beam auth-screen-card__beam--bottom"
                  animate={{
                    right: ["-50%", "100%"],
                    opacity: [0.3, 0.7, 0.3],
                  }}
                  transition={{
                    right: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 1.2 },
                    opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 1.2 },
                  }}
                />
                <motion.div
                  className="auth-screen-card__beam auth-screen-card__beam--left"
                  animate={{
                    bottom: ["-50%", "100%"],
                    opacity: [0.3, 0.7, 0.3],
                  }}
                  transition={{
                    bottom: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 1.8 },
                    opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 1.8 },
                  }}
                />
                <motion.div
                  className="auth-screen-card__corner auth-screen-card__corner--tl"
                  animate={{ opacity: [0.25, 0.55, 0.25] }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: "mirror" }}
                />
                <motion.div
                  className="auth-screen-card__corner auth-screen-card__corner--tr"
                  animate={{ opacity: [0.3, 0.65, 0.3] }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatType: "mirror", delay: 0.5 }}
                />
                <motion.div
                  className="auth-screen-card__corner auth-screen-card__corner--br"
                  animate={{ opacity: [0.3, 0.65, 0.3] }}
                  transition={{ duration: 2.2, repeat: Infinity, repeatType: "mirror", delay: 1 }}
                />
                <motion.div
                  className="auth-screen-card__corner auth-screen-card__corner--bl"
                  animate={{ opacity: [0.25, 0.55, 0.25] }}
                  transition={{ duration: 2.3, repeat: Infinity, repeatType: "mirror", delay: 1.5 }}
                />
              </div>

              <div className="auth-screen-card__inner">
                <div className="auth-screen-card__header">
                  <motion.div
                    className="auth-screen-card__logo"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", duration: 0.8 }}
                  >
                    D
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {mode === "sign-in" ? "Vítej zpět" : "Vytvoř účet"}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    {mode === "sign-in"
                      ? "Přihlas se do DoNext"
                      : "Zaregistruj se a začni synchronizovat úkoly"}
                  </motion.p>
                </div>

                {!isSupabaseConfigured ? (
                  <p className="auth-widget__message" data-tone="danger">
                    Supabase není nakonfigurovaný.
                  </p>
                ) : (
                  <form className="auth-screen-card__form" onSubmit={handleSubmit}>
                    <motion.div
                      className="auth-screen-card__field"
                      data-focused={focusedField === "email"}
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <Mail aria-hidden="true" size={16} />
                      <input
                        autoComplete="email"
                        inputMode="email"
                        placeholder="E-mailová adresa"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.currentTarget.value)}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => setFocusedField(null)}
                        required
                      />
                    </motion.div>

                    <motion.div
                      className="auth-screen-card__field"
                      data-focused={focusedField === "password"}
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <Lock aria-hidden="true" size={16} />
                      <input
                        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                        minLength={6}
                        placeholder="Heslo"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.currentTarget.value)}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField(null)}
                        required
                      />
                      <button
                        aria-label={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
                        className="auth-screen-card__password-toggle"
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        {showPassword ? <Eye aria-hidden="true" size={16} /> : <EyeClosed aria-hidden="true" size={16} />}
                      </button>
                    </motion.div>

                    <motion.button
                      className="auth-screen-card__submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={isAuthLoading}
                    >
                      <AnimatePresence mode="wait">
                        {isAuthLoading ? (
                          <motion.span
                            key="loading"
                            className="auth-screen-card__spinner"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            aria-hidden="true"
                          />
                        ) : (
                          <motion.span
                            key="label"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            {mode === "sign-in" ? "Přihlásit se" : "Vytvořit účet"}
                            <ArrowRight aria-hidden="true" size={14} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>

                    <motion.p
                      className="auth-screen-card__switch"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      {mode === "sign-in" ? "Nemáš účet? " : "Už máš účet? "}
                      <button
                        type="button"
                        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
                      >
                        {mode === "sign-in" ? "Zaregistruj se" : "Přihlas se"}
                      </button>
                    </motion.p>
                  </form>
                )}

                {messages}
              </div>
            </div>
          </motion.div>
        </motion.div>
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
              ? "Sync ukládá"
              : isCloudReady
                ? "Sync zapnutý"
                : "Sync načítá"
            : "Přihlásit"}
        </span>
      </button>
      <AnimatePresence>
      {isOpen ? (
        <div className="auth-widget" role="presentation">
          <motion.button
            className="auth-widget__backdrop"
            aria-label="Zavřít přihlášení"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" as const }}
            onClick={() => setIsOpen(false)}
          />
          <motion.section
            className="auth-widget__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-widget-title"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <div className="auth-widget__header">
              <div>
                <strong id="auth-widget-title">Účet a sync</strong>
                <span>
                  {user
                    ? user.email
                    : "Přihlášení je připravené pro synchronizaci a týmy."}
                </span>
                {user ? (
                  <span>
                    {isAutoSyncing
                      ? "Automaticky ukládám změny."
                      : isCloudReady
                        ? "Automaticky načítám i ukládám změny."
                        : "Načítám cloudová data."}
                  </span>
                ) : null}
              </div>
              <button
                aria-label="Zavřít"
                className="auth-widget__close"
                type="button"
                onClick={() => setIsOpen(false)}
              >
                x
              </button>
            </div>

            {!isSupabaseConfigured ? (
              <p className="auth-widget__message" data-tone="danger">
                Supabase není nakonfigurovaný.
              </p>
            ) : user ? (
              <div className="auth-widget__signed-in">
                <p>
                  Sync běží automaticky. Změny se ukládají na pozadí a po
                  přihlášení se data sama načtou z cloudu.
                </p>
                <button type="button" onClick={onSignOut} disabled={isAuthLoading}>
                  Odhlásit
                </button>
              </div>
            ) : (
              form
            )}

            {messages}
          </motion.section>
        </div>
      ) : null}
      </AnimatePresence>
    </>
  );
}
