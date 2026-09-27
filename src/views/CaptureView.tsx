import { useI18n } from '../i18n/context';
import { useToast } from '../hooks/useToast';
import { useAppActions } from '../hooks/useAppActions';
import { createCapture } from '../captures/repo';
import type { CaptureInput } from '../captures/types';
import { CaptureForm } from '../components/CaptureForm';

interface Props {
  initial?: CaptureInput;
  photoFirst?: boolean;
  fromShare?: boolean;
}

export function CaptureView({ initial, photoFirst = false, fromShare = false }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const { sync } = useAppActions();
  return (
    <section aria-labelledby="capture-heading" className="flex flex-col gap-4">
      <h1 id="capture-heading" className="text-2xl font-bold">
        {t('capture.heading')}
      </h1>
      {fromShare && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('capture.fromShare')}</p>
      )}
      <CaptureForm
        initial={initial}
        submitLabel="capture.submit"
        photoFirst={photoFirst}
        resetOnSubmit
        onSubmit={async (input) => {
          await createCapture(input);
          toast('capture.saved');
          sync();
        }}
      />
    </section>
  );
}
