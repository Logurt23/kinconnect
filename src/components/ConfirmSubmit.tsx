"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that asks first (for deletes and other things that can't be undone) and shows a
 * pending label while the form is sending, so a second click can't fire it twice.
 */
export function ConfirmSubmit({
  confirm,
  pending,
  className = "btn-danger",
  title,
  ariaLabel,
  name,
  value,
  children,
}: {
  confirm?: string;
  pending?: string;
  className?: string;
  title?: string;
  /** Only for icon-only buttons; otherwise the visible text is the name. */
  ariaLabel?: string;
  name?: string;
  value?: string;
  children: React.ReactNode;
}) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      title={title}
      aria-label={ariaLabel}
      className={className}
      disabled={status.pending}
      aria-busy={status.pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {status.pending && pending ? pending : children}
    </button>
  );
}
