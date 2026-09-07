import QRCode from "qrcode";

/** QR rendering intentionally belongs to this plugin, not to the host SDK. */
export function renderQrCode(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { width: 280, margin: 2, errorCorrectionLevel: "M" });
}

/** Accept the upstream server's ready-to-display data URL as well as a QR payload. */
export function renderQrPayload(payload: string): Promise<string> {
  if (/^data:image\/(?:png|jpeg|jpg|webp);base64,/iu.test(payload)) return Promise.resolve(payload);
  return renderQrCode(payload);
}
