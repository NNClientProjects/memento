'use client';

import { useState } from 'react';

export type CopyRow = {
  full_name: string;
  email: string | null;
  phone_e164: string | null;
  dorm: string | null;
  dorm_number: string | null;
  section: string | null;
  family_group_id: string | null;
  lifecycle_stage: string;
  payment_status: string;
};

export function CopyButtons({ rows }: { rows: CopyRow[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  const showCopied = (label: string) => {
    setCopied(label);
    window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 1800);
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showCopied(label);
    } catch {
      showCopied('Copy failed');
    }
  };

  const emails = rows
    .map((r) => r.email)
    .filter((e): e is string => !!e);
  const phones = rows
    .map((r) => r.phone_e164)
    .filter((e): e is string => !!e);

  const tsvHeader =
    'Name\tEmail\tPhone\tDorm\tSection\tFamily\tStage\tPayment';
  const tsv =
    tsvHeader +
    '\n' +
    rows
      .map((r) =>
        [
          r.full_name,
          r.email ?? '',
          r.phone_e164 ?? '',
          r.dorm
            ? r.dorm + (r.dorm_number ? ` #${r.dorm_number}` : '')
            : '',
          r.section ?? '',
          r.family_group_id ?? '',
          r.lifecycle_stage,
          r.payment_status,
        ]
          .map((c) => String(c).replace(/[\t\n\r]/g, ' '))
          .join('\t')
      )
      .join('\n');

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <BtnLabel>Copy:</BtnLabel>
      <CopyBtn
        disabled={emails.length === 0}
        label={`Emails (${emails.length})`}
        active={copied === 'emails'}
        onClick={() => copy(emails.join(', '), 'emails')}
      />
      <CopyBtn
        disabled={phones.length === 0}
        label={`Phones (${phones.length})`}
        active={copied === 'phones'}
        onClick={() => copy(phones.join(', '), 'phones')}
      />
      <CopyBtn
        disabled={rows.length === 0}
        label={`Table (${rows.length})`}
        active={copied === 'tsv'}
        onClick={() => copy(tsv, 'tsv')}
      />
      {copied && (
        <span className="text-xs text-green-700 dark:text-green-400">
          ✓ Copied
        </span>
      )}
    </div>
  );
}

function BtnLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs uppercase tracking-wider text-zinc-500">
      {children}
    </span>
  );
}

function CopyBtn({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
        active
          ? 'border-green-500 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950/30 dark:text-green-300'
          : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900'
      }`}
    >
      {label}
    </button>
  );
}
