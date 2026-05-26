const LOGO_PATH = "/img/expiation-text-logo-blue.png";

type LogoData = {
  dataUrl: string;
  width: number;
  height: number;
};

let cached: LogoData | null = null;

export async function loadLogo(): Promise<LogoData | null> {
  if (cached) return cached;
  try {
    const resp = await fetch(LOGO_PATH);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    return new Promise<LogoData | null>((resolve) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        cached = {
          dataUrl: canvas.toDataURL("image/png"),
          width: img.naturalWidth,
          height: img.naturalHeight,
        };
        URL.revokeObjectURL(objectUrl);
        resolve(cached);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}
