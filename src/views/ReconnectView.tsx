import { useI18n } from '../i18n/context';
import { TokenForm } from '../components/TokenForm';

/** Affiché quand Orqea répond 401 : ressaisir un jeton, ou continuer à capturer hors ligne. */
export function ReconnectView({ onLater }: { onLater: () => void }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="reconnect-heading" className="card flex flex-col gap-4">
      <h1 id="reconnect-heading" className="text-2xl font-bold">
        {t('reconnect.heading')}
      </h1>
      <p>{t('reconnect.body')}</p>
      <TokenForm />
      <button type="button" className="btn-secondary self-start" onClick={onLater}>
        {t('reconnect.later')}
      </button>
    </section>
  );
}
