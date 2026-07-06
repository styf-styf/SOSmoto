import { supabase } from './supabase';
import type { MotoType, Vehicle } from '../types/database';

export async function getVehicles(userId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Vehicle[];
}

export interface CreateVehicleParams {
  userId: string;
  brand: string;
  model: string;
  year: number;
  plate?: string;
  currentMileage: number;
  motoType: MotoType;
  avgMonthlyKm?: number;
}

export async function createVehicle(params: CreateVehicleParams): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      user_id: params.userId,
      brand: params.brand,
      model: params.model,
      year: params.year,
      plate: params.plate ?? null,
      current_mileage: params.currentMileage,
      moto_type: params.motoType,
      avg_monthly_km: params.avgMonthlyKm ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Vehicle;
}

export async function updateMileage(
  vehicleId: string,
  mileage: number,
  avgMonthlyKm?: number | null
): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .update({
      current_mileage: mileage,
      last_mileage_update: new Date().toISOString(),
      last_mileage_reminder_at: null,
      ...(avgMonthlyKm !== undefined ? { avg_monthly_km: avgMonthlyKm } : {}),
    })
    .eq('id', vehicleId)
    .select()
    .single();

  if (error) throw error;
  return data as Vehicle;
}

export async function updatePlate(vehicleId: string, plate: string): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .update({ plate: plate.trim().toUpperCase() || null })
    .eq('id', vehicleId)
    .select()
    .single();
  if (error) throw error;
  return data as Vehicle;
}

export interface UpdateVehicleParams {
  brand: string;
  model: string;
  year: number;
  plate: string;
  currentMileage: number;
  avgMonthlyKm?: number | null;
  motoType: MotoType;
}

export async function updateVehicle(vehicleId: string, params: UpdateVehicleParams): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .update({
      brand: params.brand,
      model: params.model,
      year: params.year,
      plate: params.plate.trim().toUpperCase() || null,
      current_mileage: params.currentMileage,
      avg_monthly_km: params.avgMonthlyKm ?? null,
      moto_type: params.motoType,
      last_mileage_update: new Date().toISOString(),
      last_mileage_reminder_at: null,
    })
    .eq('id', vehicleId)
    .select()
    .single();
  if (error) throw error;
  return data as Vehicle;
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
  if (error) throw error;
}
