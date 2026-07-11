import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

const BUCKET = 'public-images';
const KYC_BUCKET = 'kyc-documents';
const MAX_WIDTH = 1280;
const COMPRESSION_QUALITY = 0.7;

// Recorte 3:4 por defecto en todos los flujos de subir imagen de la app
// (catálogo, logo, publicaciones, avatar, chat, anuncios, KYC) -- así todas
// las fotos quedan con una proporción consistente. Las historias son la
// excepción: usan recorte completo/libre (pasar `null` explícito) porque ahí
// sí queremos que el usuario pueda subir la foto sin forzar 3:4.
const DEFAULT_ASPECT: [number, number] = [3, 4];

export async function pickImageFromLibrary(aspect?: [number, number] | null): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos permiso para acceder a tus fotos.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: aspect === null ? undefined : aspect ?? DEFAULT_ASPECT,
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0];
}

export async function pickImageFromCamera(aspect?: [number, number] | null): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos permiso para usar la cámara.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: aspect === null ? undefined : aspect ?? DEFAULT_ASPECT,
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0];
}

// Redimensiona (solo si excede el ancho máximo, nunca agranda) y comprime a
// JPEG antes de subir — reduce tamaño de archivo y consumo de bandwidth.
async function optimizeImage(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const actions = asset.width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];
  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: COMPRESSION_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

export async function uploadBusinessImage(asset: ImagePicker.ImagePickerAsset, businessId: string): Promise<string> {
  const optimizedUri = await optimizeImage(asset);
  const arrayBuffer = await (await fetch(optimizedUri)).arrayBuffer();
  const path = `${businessId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function pickAndUploadBusinessImage(businessId: string): Promise<string | null> {
  const asset = await pickImageFromLibrary();
  if (!asset) return null;
  return uploadBusinessImage(asset, businessId);
}

// Historias de negocio -- recorte completo/libre, sin forzar 3:4 (ver nota
// junto a DEFAULT_ASPECT más arriba).
export async function pickAndUploadBusinessStoryImage(businessId: string): Promise<string | null> {
  const asset = await pickImageFromLibrary(null);
  if (!asset) return null;
  return uploadBusinessImage(asset, businessId);
}

export async function uploadClientStoryImage(asset: ImagePicker.ImagePickerAsset, clientId: string): Promise<string> {
  const optimizedUri = await optimizeImage(asset);
  const arrayBuffer = await (await fetch(optimizedUri)).arrayBuffer();
  const path = `client-stories/${clientId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function pickAndUploadClientStoryImage(clientId: string): Promise<string | null> {
  const asset = await pickImageFromLibrary(null);
  if (!asset) return null;
  return uploadClientStoryImage(asset, clientId);
}

export async function uploadClientPostImage(asset: ImagePicker.ImagePickerAsset, clientId: string): Promise<string> {
  const optimizedUri = await optimizeImage(asset);
  const arrayBuffer = await (await fetch(optimizedUri)).arrayBuffer();
  const path = `posts/${clientId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function pickAndUploadClientPostImage(clientId: string): Promise<string | null> {
  const asset = await pickImageFromLibrary();
  if (!asset) return null;
  return uploadClientPostImage(asset, clientId);
}

export async function uploadUserAvatar(asset: ImagePicker.ImagePickerAsset, userId: string): Promise<string> {
  const optimizedUri = await optimizeImage(asset);
  const arrayBuffer = await (await fetch(optimizedUri)).arrayBuffer();
  const path = `avatars/${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function pickAndUploadUserAvatar(userId: string): Promise<string | null> {
  const asset = await pickImageFromLibrary();
  if (!asset) return null;
  return uploadUserAvatar(asset, userId);
}

export async function uploadChatImage(asset: ImagePicker.ImagePickerAsset, senderId: string): Promise<string> {
  const optimizedUri = await optimizeImage(asset);
  const arrayBuffer = await (await fetch(optimizedUri)).arrayBuffer();
  const path = `chat-images/${senderId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Bucket privado (kyc-documents, no kyc-images): documentos de identidad, no
// se devuelve una URL pública -- se guarda solo la ruta, y el admin panel
// genera URLs firmadas de corta duración con el service role para mostrarlos.
export async function uploadKycDocument(
  asset: ImagePicker.ImagePickerAsset,
  businessId: string,
  kind: 'id-document' | 'ruc-document' | 'storefront-photo'
): Promise<string> {
  const optimizedUri = await optimizeImage(asset);
  const arrayBuffer = await (await fetch(optimizedUri)).arrayBuffer();
  const path = `${businessId}/${kind}-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(KYC_BUCKET).upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  return path;
}
