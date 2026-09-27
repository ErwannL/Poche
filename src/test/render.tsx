import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { ReactElement } from 'react';
import { I18nProvider } from '../i18n/I18nProvider';
import { ToastContext } from '../hooks/useToast';
import { AppActionsContext } from '../hooks/useAppActions';
import type { Locale } from '../settings/types';

export function renderUi(ui: ReactElement, locale: Locale = 'fr') {
  const toast = vi.fn();
  const sync = vi.fn();
  const utils = render(
    <I18nProvider locale={locale}>
      <ToastContext value={toast}>
        <AppActionsContext value={{ sync }}>{ui}</AppActionsContext>
      </ToastContext>
    </I18nProvider>,
  );
  return { ...utils, toast, sync };
}
