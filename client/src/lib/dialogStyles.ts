export function getColorSettings() {
  try {
    const saved = localStorage.getItem('colorSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        headerBar: parsed.headerBar || '#051729',
        mainBackground: parsed.mainBackground || '#3a8bbf',
        mainBackgroundGradientEnd: parsed.mainBackgroundGradientEnd || '#164a72',
      };
    }
  } catch {}
  return {
    headerBar: '#051729',
    mainBackground: '#3a8bbf',
    mainBackgroundGradientEnd: '#164a72',
  };
}

export function dialogContentStyle(cs: ReturnType<typeof getColorSettings>) {
  return {
    background: `linear-gradient(180deg, ${cs.mainBackground} 0%, color-mix(in srgb, ${cs.mainBackgroundGradientEnd} 70%, black) 100%)`,
    border: '1.5px solid rgba(255,255,255,0.35)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.05)',
  } as const;
}

export function dialogHeaderStyle(cs: ReturnType<typeof getColorSettings>) {
  return {
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${cs.headerBar}cc 40%, ${cs.headerBar}bb 100%)`,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)',
  } as const;
}

export const DIALOG_CONTENT_CLASS = "text-white [&_*]:text-white p-0 [&>button.absolute]:hidden overflow-hidden";
export const DIALOG_HEADER_CLASS = "flex items-center gap-2 px-4 py-3 border-b border-white/40 flex-shrink-0 rounded-t-lg";
export const DIALOG_TITLE_STYLE = {
  fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif",
  textShadow: '0 1px 2px rgba(0,0,0,0.2)',
  fontSize: '12px',
} as const;
