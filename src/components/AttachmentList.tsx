import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/context';
import type { CaptureAttachment } from '../captures/types';

function Thumbnail({ attachment }: { attachment: CaptureAttachment }) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (attachment.kind !== 'image') return;
    const objectUrl = URL.createObjectURL(attachment.blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [attachment]);
  if (url) return <img src={url} alt="" className="size-16 rounded-lg object-cover" />;
  return (
    <span className="flex size-16 items-center justify-center rounded-lg bg-slate-200 text-xs dark:bg-slate-700">
      {attachment.kind === 'audio' ? t('attachment.audio') : attachment.name.split('.').pop()}
    </span>
  );
}

interface Props {
  attachments: CaptureAttachment[];
  onRemove: (id: string) => void;
}

export function AttachmentList({ attachments, onRemove }: Props) {
  const { t } = useI18n();
  if (attachments.length === 0) return null;
  return (
    <ul aria-label={t('attachment.list')} className="flex flex-wrap gap-3">
      {attachments.map((attachment) => (
        <li key={attachment.id} className="flex items-center gap-2">
          <Thumbnail attachment={attachment} />
          <button
            type="button"
            className="btn-secondary px-2"
            aria-label={t('attachment.remove', { name: attachment.name })}
            onClick={() => {
              onRemove(attachment.id);
            }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
