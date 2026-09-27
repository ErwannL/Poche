import { createContext, useContext } from 'react';
import type { MessageKey } from '../i18n/translate';

export type ShowToast = (key: MessageKey, tone?: 'info' | 'error') => void;

export const ToastContext = createContext<ShowToast>(() => undefined);

export const useToast = (): ShowToast => useContext(ToastContext);
