import { AlertTriangle, HelpCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red button + warning icon for actions that delete or replace data. */
  destructive?: boolean;
}
type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

const Ctx = createContext<Confirm | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirmBtn = useRef<HTMLButtonElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  const confirm = useCallback<Confirm>((o) => {
    opener.current = document.activeElement;
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
    (opener.current as HTMLElement | null)?.focus?.();
  }, []);

  // Focus the safe choice first (Cancel for destructive actions); Esc cancels; Tab stays inside.
  useEffect(() => {
    if (!opts) return;
    (opts.destructive ? cancelBtn : confirmBtn).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Tab') {
        const first = cancelBtn.current;
        const last = confirmBtn.current;
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [opts, close]);

  const value = useMemo(() => confirm, [confirm]);
  const Icon = opts?.destructive ? AlertTriangle : HelpCircle;
  return (
    <Ctx.Provider value={value}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => close(false)}
            aria-hidden
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={opts.message ? 'confirm-msg' : undefined}
            className="card relative w-full max-w-md p-6 shadow-lift"
          >
            <div className="flex gap-4">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  opts.destructive ? 'bg-danger-soft text-danger' : 'bg-brand-100 text-brand-800'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2
                  id="confirm-title"
                  className="font-display text-xl font-extrabold leading-tight"
                >
                  {opts.title}
                </h2>
                {opts.message && (
                  <p id="confirm-msg" className="mt-1.5 text-sm leading-relaxed text-ink-700">
                    {opts.message}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button ref={cancelBtn} className="btn-secondary" onClick={() => close(false)}>
                {opts.cancelLabel ?? 'Cancel'}
              </button>
              <button
                ref={confirmBtn}
                className={opts.destructive ? 'btn-danger' : 'btn-primary'}
                onClick={() => close(true)}
              >
                {opts.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm(): Confirm {
  const v = useContext(Ctx);
  if (!v) throw new Error('useConfirm outside ConfirmProvider');
  return v;
}
