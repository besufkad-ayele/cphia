/** Trigger a browser download from a successful export Response. */
export async function downloadExportResponse(response: Response, fallbackName: string) {
  const blob = await response.blob();
  const header = response.headers.get('Content-Disposition') || '';
  const match =
    /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(header);
  const raw = match?.[1] || match?.[2] || match?.[3] || fallbackName;
  const filename = decodeURIComponent(raw.trim().replace(/^"|"$/g, '')) || fallbackName;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export async function readExportError(response: Response) {
  const payload = await response.json().catch(() => null) as
    | { message?: string; error?: string; details?: string }
    | null;
  return (
    payload?.message
    || payload?.details
    || payload?.error
    || `Export failed (${response.status}).`
  );
}
