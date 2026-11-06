function downloadSvg(registrationId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><rect width='100%' height='100%' fill='%230a3f3a'/><text x='60' y='180' fill='white' font-size='36' font-family='Arial'>CPHIA 2026 Volunteer Registration</text><text x='60' y='330' fill='%23F5C518' font-size='72' font-weight='700' font-family='Arial'>${registrationId}</text><text x='60' y='430' fill='white' font-size='28' font-family='Arial'>${today}</text></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const link = document.createElement('a');
  link.href = url;
  link.download = `${registrationId}.svg`;
  link.click();
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadIdAsImage(registrationId: string, onFallbackError?: (message: string) => void) {
  try {
    const canvas = document.createElement('canvas');
    if (!canvas.getContext) {
      downloadSvg(registrationId);
      return;
    }

    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext('2d');
    if (!context) {
      downloadSvg(registrationId);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const gradient = context.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, '#0A3F3A');
    gradient.addColorStop(1, '#186059');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1200, 630);

    context.fillStyle = '#F5C518';
    context.fillRect(0, 0, 16, 630);

    context.fillStyle = '#ffffff';
    context.font = 'bold 36px Arial';
    context.fillText('CPHIA 2026 Volunteer Registration', 72, 180);

    context.fillStyle = '#F5C518';
    context.font = 'bold 64px Arial';
    context.fillText(registrationId, 72, 310);

    context.fillStyle = '#d9f4ef';
    context.font = '28px Arial';
    context.fillText(today, 72, 400);
    context.fillText('Keep this ID for check-in and training days.', 72, 460);

    canvas.toBlob((blob) => {
      if (!blob) {
        downloadSvg(registrationId);
        onFallbackError?.('Could not export PNG. Saved SVG instead.');
        return;
      }
      triggerBlobDownload(blob, `${registrationId}.png`);
    }, 'image/png');
  } catch {
    downloadSvg(registrationId);
    onFallbackError?.('Could not export PNG. Saved SVG instead.');
  }
}
