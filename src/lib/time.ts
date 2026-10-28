// Time helpers kept outside components (render must stay pure).
export const daysFromNowIso = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
