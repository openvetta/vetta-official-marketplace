import QRCode from "qrcode";

/** QR rendering intentionally belongs to this plugin, not to the host SDK. */
export function renderQrCode(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { width: 280, margin: 2, errorCorrectionLevel: "M" });
}
