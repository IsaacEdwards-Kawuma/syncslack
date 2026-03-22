/** localStorage key — show snippet in socket toast notifications */
export const LS_MESSAGE_PREVIEW = 'syncwork.settings.messagePreviewInNotif';

export function readMessagePreviewInNotif() {
  try {
    return localStorage.getItem(LS_MESSAGE_PREVIEW) !== '0';
  } catch {
    return true;
  }
}
