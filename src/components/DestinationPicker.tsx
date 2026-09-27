import { useEffect } from 'react';
import { useI18n } from '../i18n/context';
import { useLive } from '../hooks/useLive';
import { getCachedBoards, getCachedLists, refreshLists } from '../destinations/cache';
import { withClient } from '../orqea/session';

export interface Destination {
  boardId?: string;
  listId?: string;
}

interface Props extends Destination {
  idPrefix: string;
  /** Propose « destination par défaut » (formulaire de capture) plutôt que « Choisir… ». */
  allowDefault: boolean;
  onChange: (destination: Destination) => void;
}

export function DestinationPicker({ idPrefix, boardId, listId, allowDefault, onChange }: Props) {
  const { t } = useI18n();
  const boards = useLive(getCachedBoards, ['destinations']) ?? [];
  const lists =
    useLive(
      () => (boardId ? getCachedLists(boardId) : Promise.resolve([])),
      ['destinations'],
      boardId,
    ) ?? [];

  useEffect(() => {
    if (boardId) void withClient((client) => refreshLists(client, boardId)).catch(() => undefined);
  }, [boardId]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor={`${idPrefix}-board`}>
          {t('settings.boardLabel')}
        </label>
        <select
          id={`${idPrefix}-board`}
          className="field"
          value={boardId ?? ''}
          onChange={(event) => {
            onChange({ boardId: event.target.value || undefined, listId: undefined });
          }}
        >
          <option value="">{t(allowDefault ? 'settings.useDefault' : 'settings.choose')}</option>
          {boards.map((board) => (
            <option key={board.id} value={board.id} disabled={board.encrypted}>
              {board.encrypted ? t('settings.unsupported', { title: board.title }) : board.title}
            </option>
          ))}
        </select>
      </div>
      {boardId && (
        <div>
          <label className="label" htmlFor={`${idPrefix}-list`}>
            {t('settings.listLabel')}
          </label>
          <select
            id={`${idPrefix}-list`}
            className="field"
            value={listId ?? ''}
            onChange={(event) => {
              onChange({ boardId, listId: event.target.value || undefined });
            }}
          >
            <option value="">{t('settings.choose')}</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
