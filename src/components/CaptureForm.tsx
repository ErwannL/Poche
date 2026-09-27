import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { useI18n } from '../i18n/context';
import type { MessageKey } from '../i18n/translate';
import { PRIORITIES, type Priority } from '../orqea/types';
import type { CaptureAttachment, CaptureInput } from '../captures/types';
import { dueToday, dueTomorrow, fromLocalInput, toLocalInput } from '../captures/due';
import { compressImage } from '../media/image';
import { useVoice } from '../media/useVoice';
import { newId } from '../lib/id';
import { useToast } from '../hooks/useToast';
import { AttachmentList } from './AttachmentList';
import { DestinationPicker } from './DestinationPicker';

interface Props {
  initial?: CaptureInput;
  submitLabel: MessageKey;
  onSubmit: (input: CaptureInput) => Promise<void>;
  onCancel?: () => void;
  /** Ouvert via le raccourci « Photo » : met en avant le bouton photo. */
  photoFirst?: boolean;
  /** Vide le formulaire après envoi (écran de capture). */
  resetOnSubmit?: boolean;
}

const EMPTY: CaptureInput = { title: '', attachments: [] };

export function CaptureForm({
  initial = EMPTY,
  submitLabel,
  onSubmit,
  onCancel,
  photoFirst = false,
  resetOnSubmit = false,
}: Props) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const id = useId();
  const [value, setValue] = useState<CaptureInput>(initial);
  const [showError, setShowError] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const photoButtonRef = useRef<HTMLButtonElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const patch = (next: Partial<CaptureInput>) => {
    setValue((current) => ({ ...current, ...next }));
  };
  const addAttachment = (attachment: CaptureAttachment) => {
    setValue((current) => ({ ...current, attachments: [...current.attachments, attachment] }));
  };

  const voice = useVoice({
    lang: locale === 'fr' ? 'fr-FR' : 'en-US',
    onText: (text) => {
      setValue((current) => ({
        ...current,
        title: [current.title.trim(), text].filter(Boolean).join(' '),
      }));
    },
    onAudio: (blob) => {
      addAttachment({
        id: newId(),
        name: `${t('voice.memoName')}.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`,
        type: blob.type,
        kind: 'audio',
        blob,
      });
    },
  });

  useEffect(() => {
    (photoFirst ? photoButtonRef : titleRef).current?.focus();
  }, [photoFirst]);

  const onPhotos = async (input: HTMLInputElement) => {
    // `files` n'est jamais nul sur un input de type file.
    for (const file of Array.from(input.files as FileList)) {
      try {
        const image = await compressImage(file);
        addAttachment({ id: newId(), kind: 'image', ...image });
      } catch {
        toast('photo.error', 'error');
      }
    }
    input.value = '';
  };

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (!value.title.trim()) {
      setShowError(true);
      titleRef.current?.focus();
      return;
    }
    setBusy(true);
    await onSubmit(value);
    setBusy(false);
    setShowError(false);
    if (resetOnSubmit) {
      setValue(EMPTY);
      titleRef.current?.focus();
    }
  };

  const errorId = `${id}-error`;
  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
      <div>
        <label htmlFor={`${id}-title`} className="sr-only">
          {t('capture.titleLabel')}
        </label>
        <textarea
          id={`${id}-title`}
          ref={titleRef}
          className="field min-h-28 resize-y text-lg"
          placeholder={t('capture.titlePlaceholder')}
          value={value.title}
          maxLength={500}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          onChange={(event) => {
            patch({ title: event.target.value });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        {showError && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {t('capture.titleRequired')}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {voice.mode !== 'none' && (
          <button
            type="button"
            className="btn-secondary"
            aria-pressed={voice.active}
            onClick={() => void voice.toggle()}
          >
            <span aria-hidden="true">🎙️</span>
            {voice.mode === 'speech'
              ? t(voice.active ? 'voice.stop' : 'voice.start')
              : t(voice.active ? 'voice.stopRecording' : 'voice.record')}
          </button>
        )}
        <button
          type="button"
          ref={photoButtonRef}
          className={photoFirst ? 'btn-primary' : 'btn-secondary'}
          onClick={() => photoInputRef.current?.click()}
        >
          <span aria-hidden="true">📷</span>
          {t('photo.add')}
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          data-testid="photo-input"
          onChange={(event) => void onPhotos(event.currentTarget)}
        />
      </div>
      <p aria-live="polite" className="text-sm text-slate-600 dark:text-slate-400">
        {voice.active && t(voice.mode === 'speech' ? 'voice.listening' : 'voice.recording')}
        {voice.error && t('voice.error')}
        {photoFirst && !voice.active && !voice.error && t('photo.hint')}
      </p>

      <AttachmentList
        attachments={value.attachments}
        onRemove={(attachmentId) => {
          patch({ attachments: value.attachments.filter((a) => a.id !== attachmentId) });
        }}
      />

      <fieldset>
        <legend className="label">{t('capture.dueLabel')}</legend>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="chip"
            onClick={() => {
              patch({ dueDate: dueToday() });
            }}
          >
            {t('capture.dueToday')}
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              patch({ dueDate: dueTomorrow() });
            }}
          >
            {t('capture.dueTomorrow')}
          </button>
          <label className="sr-only" htmlFor={`${id}-due`}>
            {t('capture.dueCustom')}
          </label>
          <input
            id={`${id}-due`}
            type="datetime-local"
            className="field w-auto"
            value={toLocalInput(value.dueDate)}
            onChange={(event) => {
              patch({ dueDate: fromLocalInput(event.target.value) });
            }}
          />
          {value.dueDate && (
            <button
              type="button"
              className="chip"
              onClick={() => {
                patch({ dueDate: undefined });
              }}
            >
              {t('capture.dueClear')}
            </button>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">{t('capture.priorityLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {[undefined, ...PRIORITIES].map((priority: Priority | undefined) => (
            <button
              key={priority ?? 'none'}
              type="button"
              className="chip"
              aria-pressed={value.priority === priority}
              onClick={() => {
                patch({ priority });
              }}
            >
              {priority ? t(`priority.${priority}`) : t('capture.priorityNone')}
            </button>
          ))}
        </div>
      </fieldset>

      <details className="card" open={Boolean(value.description ?? value.listId)}>
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">
          {t('capture.details')}
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <label className="label" htmlFor={`${id}-description`}>
              {t('capture.descriptionLabel')}
            </label>
            <textarea
              id={`${id}-description`}
              className="field min-h-20"
              value={value.description ?? ''}
              onChange={(event) => {
                patch({ description: event.target.value });
              }}
            />
          </div>
          <fieldset>
            <legend className="label">{t('capture.destinationLabel')}</legend>
            <DestinationPicker
              idPrefix={`${id}-dest`}
              boardId={value.boardId}
              listId={value.listId}
              allowDefault
              onChange={patch}
            />
          </fieldset>
        </div>
      </details>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 text-lg" disabled={busy}>
          {t(submitLabel)}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t('capture.cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
