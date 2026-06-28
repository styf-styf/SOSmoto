import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

const BUCKET = 'public-images';
const MAX_WIDTH = 1280;
const COMPRESSION_QUALITY = 0.7;

export async function pickImageFromLibrary(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos permiso para acceder a tus fotos.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
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
  const asset = await pickImageFromLibrary();
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
