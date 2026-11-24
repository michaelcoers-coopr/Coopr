import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export async function pickLogoFile(): Promise<{ name: string; dataUrl: string } | null> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/svg+xml,.svg';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name.replace(/\.[^.]+$/, '') || 'Sponsor', dataUrl: String(reader.result ?? '') });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }
  const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.base64) return null;
  const mime = asset.mimeType ?? 'image/jpeg';
  return { name: asset.fileName?.replace(/\.[^.]+$/, '') || 'Sponsor', dataUrl: `data:${mime};base64,${asset.base64}` };
}
