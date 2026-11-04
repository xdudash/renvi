// Playbook copy per app language. Languages without their own copy use English.
import type { LangCode } from '../i18n/index.ts';
import type { PlaybookContent } from './types.ts';
import { RU } from './ru.ts';
import { EN } from './en.ts';

const BY_LANG: Partial<Record<LangCode, PlaybookContent>> = { RU, EN };

export function playbookContent(lang: LangCode | string): PlaybookContent {
  return BY_LANG[lang as LangCode] ?? EN;
}

export type * from './types.ts';
