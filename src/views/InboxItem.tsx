import { useState } from 'react';
import { useI18n } from '../i18n/context';
import { useToast } from '../hooks/useToast';
import { useAppActions } from '../hooks/useAppActions';
import { deleteCapture, editCapture, isEditable, retryCapture } from '../captures/repo';
import type { Capture, CaptureStatus } from '../captures/types';
import { formatDue } from '../captures/due';
import { CaptureForm } from '../components/CaptureForm';

const STATUS_STYLE: Record<CaptureStatus, string> = {
  pending: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  sending: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
  sent: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  failed: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200',
};

export function InboxItem({ capture }: { capture: Capture }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { sync } = useAppActions();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <li className="card" aria-label={t('inbox.editing', { title: capture.title })}>
        <CaptureForm
          initial={capture}
          submitLabel="capture.save"
          onCancel={() => {
            setEditing(false);
          }}
          onSubmit={async (input) => {
            await editCapture(capture.id, input);
            setEditing(false);
            toast('capture.updated');
            sync();
          }}
        />
      </li>
    );
  }

  return (
    <li className="card flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold break-words">{capture.title}</h2>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLE[capture.status]}`}
        >
          {t(`status.${capture.status}`)}
        </span>
      </div>
      {capture.failure && (
        <p className="text-sm text-red-700 dark:text-red-400">{t(`failure.${capture.failure}`)}</p>
      )}
      <p className="flex flex-wrap gap-x-3 text-sm text-slate-600 dark:text-slate-400">
        {capture.dueDate && (
          <span>{t('inbox.due', { date: formatDue(capture.dueDate, locale) })}</span>
        )}
        {capture.priority && <span>{t(`priority.${capture.priority}`)}</span>}
        {capture.attachments.length > 0 && (
          <span>{t('inbox.attachments', { count: capture.attachments.length })}</span>
        )}
      </p>
      <div
        role="group"
        aria-label={t('inbox.actionsFor', { title: capture.title })}
        className="flex flex-wrap gap-2"
      >
        {capture.status === 'failed' && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              void retryCapture(capture.id).then(sync);
            }}
          >
            {t('inbox.retry')}
          </button>
        )}
        {isEditable(capture) && capture.status !== 'sending' && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setEditing(true);
            }}
          >
            {t('inbox.edit')}
          </button>
        )}
        {confirming ? (
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              void deleteCapture(capture.id).then(() => {
                toast('inbox.deleted');
              });
            }}
          >
            {t('inbox.confirmDelete')}
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setConfirming(true);
            }}
          >
            {t('inbox.delete')}
          </button>
        )}
      </div>
    </li>
  );
}
