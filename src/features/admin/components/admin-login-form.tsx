type AdminLoginFormProps = {
  errorMessage?: string;
  infoMessage?: string;
};

export function AdminLoginForm({ errorMessage, infoMessage }: AdminLoginFormProps) {
  return (
    <form
      action="/api/auth/login"
      method="post"
      className="rounded-[var(--radius-panel)] border border-white/10 bg-white/6 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-8"
    >
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-accent-soft)]">
          Admin vstup
        </p>
        <h1 className="font-display text-3xl text-white sm:text-4xl">
          Přihlášení do správy salonu
        </h1>
        <p className="text-sm leading-6 text-white/70">
          Přihlaste se ke správě rezervací, klientek a nastavení salonu.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <label className="block space-y-2">
          <span className="text-sm text-white/78">E-mail</span>
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            className="h-12 w-full rounded-2xl border border-white/12 bg-black/10 px-4 text-white outline-none transition placeholder:text-white/28 focus:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#211b17]"
            placeholder="vas@email.cz"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-white/78">Heslo</span>
          <input
            required
            type="password"
            name="password"
            autoComplete="current-password"
            className="h-12 w-full rounded-2xl border border-white/12 bg-black/10 px-4 text-white outline-none transition placeholder:text-white/28 focus:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#211b17]"
            placeholder="••••••••"
          />
        </label>

        {infoMessage ? (
          <p
            role="status"
            className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
          >
            {infoMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"
          >
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          className="h-12 w-full rounded-full bg-[var(--color-accent)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-contrast)] outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--color-accent-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#211b17]"
        >
          Přihlásit se
        </button>
      </div>
    </form>
  );
}
