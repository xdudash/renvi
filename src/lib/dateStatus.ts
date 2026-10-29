// Pure: what the invitation screens may show and offer for a date in its CURRENT server status.
// The pending/incoming screens used to assume "pending" regardless of the row, so an accepted or declined
// invitation (opened from a push, the back stack or a stale chat card) still offered Accept / Decline / Cancel.
import type { TranslationKey } from '@/i18n';

export type DateStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
export type DateView = {
  chipKey: TranslationKey;
  tone: 'amber' | 'green' | 'plain';
  /** Accept / decline / "propose another time" (only the invitee of a pending invitation). */
  canRespond: boolean;
  /** cancel_date() accepts pending and accepted rows. */
  canCancel: boolean;
};

/** `status` is null while the row is loading or could not be read: keep the screen's original pending behaviour. */
export function dateView(status: DateStatus | null | undefined, mine: boolean): DateView {
  switch (status ?? 'pending') {
    case 'accepted': return { chipKey: 'screens.dateAccepted.prinyato', tone: 'green', canRespond: false, canCancel: true };
    case 'declined': return { chipKey: 'screens.dateDeclined.chip', tone: 'plain', canRespond: false, canCancel: false };
    case 'cancelled': return { chipKey: 'screens.dateCancelled.chip', tone: 'plain', canRespond: false, canCancel: false };
    default: return mine
      ? { chipKey: 'screens.datePending.status', tone: 'amber', canRespond: false, canCancel: true }
      : { chipKey: 'screens.dateIncoming.zhdetVashegoOtveta', tone: 'amber', canRespond: true, canCancel: false };
  }
}
