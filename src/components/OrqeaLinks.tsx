import { useI18n } from '../i18n/context';
import { CREDITS, orqeaAppUrl } from '../orqea/appUrl';

/** « Propulsé par Orqea » (même onglet : la session d'Orqea vit dans l'onglet) et « Développé par Erwann Laplante ». */
export function Credits({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p
      className={`flex flex-col text-xs leading-tight text-slate-600 dark:text-slate-400 ${className ?? ''}`}
    >
      <a href={orqeaAppUrl()} target="_top" className="font-semibold hover:underline">
        {t('credits.owner', { name: 'Orqea' })}
      </a>
      <a
        href={CREDITS.author.href}
        target="_blank"
        rel="noreferrer noopener"
        className="hover:underline"
      >
        {t('credits.author', { name: CREDITS.author.name })}
      </a>
    </p>
  );
}

/** Lien de retour vers l'application Orqea (et non une déconnexion de session). */
export function BackToOrqea({ className = 'btn-secondary self-start' }: { className?: string }) {
  const { t } = useI18n();
  return (
    <a href={orqeaAppUrl()} target="_top" className={className}>
      {t('nav.backToOrqea')}
    </a>
  );
}
