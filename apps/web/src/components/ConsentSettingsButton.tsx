'use client';

export function ConsentSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('cornermaximo:open-consent-settings'))}
      className="fs-btn-ghost"
    >
      Cambiar preferencias de privacidad
    </button>
  );
}
