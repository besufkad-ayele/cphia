import type { VolunteerBadge } from './badge';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    image.src = src;
  });
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

export async function downloadIdAsImage(
  badge: VolunteerBadge,
  photoUrl?: string | null,
  ureportUrl?: string | null,
  onFallbackError?: (message: string) => void,
) {
  try {
    const width = 1200;
    const height = ureportUrl ? 780 : 680;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('NO_CONTEXT');

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0A3F3A');
    gradient.addColorStop(1, '#186059');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#F5C518';
    context.fillRect(0, 0, 18, height);

    context.fillStyle = '#ffffff';
    context.font = 'bold 22px Arial';
    context.fillText('CPHIA 2026  ·  FACILITY VOLUNTEER ID', 56, 58);

    if (photoUrl) {
      try {
        const photo = await loadImage(photoUrl);
        roundRect(context, 56, 88, 220, 280, 16);
        context.save();
        context.clip();
        context.drawImage(photo, 56, 88, 220, 280);
        context.restore();
      } catch {
        context.fillStyle = 'rgba(255,255,255,0.12)';
        context.fillRect(56, 88, 220, 280);
      }
    } else {
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(56, 88, 220, 280);
    }

    context.fillStyle = '#ffffff';
    context.font = 'bold 42px Arial';
    context.fillText(badge.name || 'Volunteer', 310, 140);
    context.fillStyle = '#d9f4ef';
    context.font = '24px Arial';
    if (badge.amharicName) context.fillText(badge.amharicName, 310, 178);

    context.fillStyle = '#F5C518';
    context.font = 'bold 36px Arial';
    context.fillText(badge.registrationId, 310, 230);

    context.fillStyle = '#ffffff';
    context.font = '22px Arial';
    const summary = [badge.sector, badge.sex, badge.age ? `${badge.age} yrs` : ''].filter(Boolean).join('  ·  ');
    context.fillText(summary, 310, 272);
    context.fillStyle = '#d9f4ef';
    context.fillText(badge.profession || '', 310, 308);

    const lines = [
      `FAN  ${badge.fanNumber || '—'}`,
      `Phone  ${badge.phone || '—'}`,
      `Nationality  ${badge.nationality || '—'}`,
      `Residence  ${badge.residence || '—'}`,
      `Languages  ${badge.languages || '—'}`,
    ];
    context.font = '20px Arial';
    lines.forEach((line, index) => {
      context.fillText(line, 310, 360 + index * 32, 820);
    });

    if (ureportUrl) {
      try {
        const shot = await loadImage(ureportUrl);
        context.fillStyle = '#ffffff';
        context.font = 'bold 18px Arial';
        context.fillText('U-Report registration', 56, 430);
        context.drawImage(shot, 56, 448, 1088, 230);
      } catch {
        // skip screenshot if it cannot be drawn
      }
    }

    context.fillStyle = '#F5C518';
    context.font = '18px Arial';
    context.fillText('Keep this ID for check-in and training days.', 56, height - 28);

    canvas.toBlob((blob) => {
      if (!blob) {
        onFallbackError?.('Could not export the volunteer ID image.');
        return;
      }
      triggerBlobDownload(blob, `${badge.registrationId || 'cphia-volunteer-id'}.png`);
    }, 'image/png');
  } catch {
    onFallbackError?.('Could not export the volunteer ID image.');
  }
}
