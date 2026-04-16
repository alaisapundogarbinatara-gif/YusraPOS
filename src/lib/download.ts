import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function downloadFile(content: string | Uint8Array, fileName: string, mimeType: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      let base64Data: string;
      
      if (content instanceof Uint8Array) {
        base64Data = arrayBufferToBase64(content);
      } else {
        base64Data = window.btoa(content);
      }

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: fileName,
        text: `Exported ${fileName}`,
        url: savedFile.uri,
        dialogTitle: `Save ${fileName}`,
      });
    } catch (error) {
      console.error('Download failed', error);
      throw error;
    }
  } else {
    // Web fallback
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
