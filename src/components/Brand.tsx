import { useI18n } from '../i18n/context';
import { Credits } from './OrqeaLinks';
import { Logo } from './Logo';

/**
 * Bloc de marque : logo (animé au survol et au focus clavier du bloc), nom suivi de
 * « par Orqea », puis dessous « Propulsé par Orqea » et « Développé par Erwann Laplante ».
 * Sert d'en-tête de l'écran principal et de pied des réglages.
 */
export function Brand({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="poche-brand flex min-w-0 items-center gap-3" data-testid="brand">
      <Logo size={size} />
      <div className="min-w-0">
        <p className="text-lg leading-tight font-bold">
          {t('app.name')} <span className="text-xs font-normal opacity-80">{t('app.byline')}</span>
        </p>
        <Credits onDark={onDark} />
      </div>
    </div>
  );
}
