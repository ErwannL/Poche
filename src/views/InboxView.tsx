import { useState } from 'react';
import { useI18n } from '../i18n/context';
import { useLive } from '../hooks/useLive';
import { useAppActions } from '../hooks/useAppActions';
import { listCaptures } from '../captures/repo';
import { isSortKey, sortCaptures, SORTS, type SortKey } from '../captures/sort';
import { InboxItem } from './InboxItem';

export function InboxView() {
  const { t } = useI18n();
  const { sync } = useAppActions();
  const captures = useLive(listCaptures, ['captures']);
  const [sort, setSort] = useState<SortKey>('newest');
  const hasQueued = captures?.some((c) => c.status === 'pending' || c.status === 'failed') ?? false;

  return (
    <section aria-labelledby="inbox-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 id="inbox-heading" className="text-2xl font-bold">
          {t('inbox.heading')}
        </h1>
        <div>
          <label className="label" htmlFor="inbox-sort">
            {t('inbox.sortLabel')}
          </label>
          <select
            id="inbox-sort"
            className="field"
            value={sort}
            onChange={(event) => {
              if (isSortKey(event.target.value)) setSort(event.target.value);
            }}
          >
            {SORTS.map((key) => (
              <option key={key} value={key}>
                {t(`inbox.sort.${key}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {hasQueued && (
        <button type="button" className="btn-secondary self-start" onClick={sync}>
          {t('inbox.sendNow')}
        </button>
      )}
      {captures?.length === 0 && (
        <p className="text-slate-600 dark:text-slate-400">{t('inbox.empty')}</p>
      )}
      <ul className="flex flex-col gap-3">
        {sortCaptures(captures ?? [], sort).map((capture) => (
          <InboxItem key={capture.id} capture={capture} />
        ))}
      </ul>
    </section>
  );
}
