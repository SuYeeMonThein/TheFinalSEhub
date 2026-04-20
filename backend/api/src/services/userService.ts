import {
  PostgrestResponse,
  PostgrestSingleResponse,
} from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabaseClient";

export type UserRole = "student" | "advisor" | "coordinator";

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  passwordHash?: string;
  role?: UserRole;
}

export const createUser = async (
  input: CreateUserInput,
): Promise<PostgrestSingleResponse<UserRecord>> => {
  const supabase = getSupabaseAdminClient();

  return supabase
    .from("user")
    .insert({
      name: input.name,
      email: input.email,
      password: input.passwordHash,
      role: input.role,
    })
    .select()
    .single();
};

export const findUserByEmail = async (
  email: string,
): Promise<PostgrestSingleResponse<UserRecord | null>> => {
  const supabase = getSupabaseAdminClient();

  return supabase.from("user").select("*").eq("email", email).maybeSingle();
};

export const findUserById = async (
  id: number,
): Promise<PostgrestSingleResponse<UserRecord | null>> => {
  const supabase = getSupabaseAdminClient();

  return supabase.from("user").select("*").eq("id", id).maybeSingle();
};

export const listUsers = async (): Promise<PostgrestResponse<UserRecord>> => {
  const supabase = getSupabaseAdminClient();

  return supabase.from("user").select("*").order("id", { ascending: true });
};

export const updateUserRecord = async (
  id: number,
  updates: UpdateUserInput,
): Promise<PostgrestSingleResponse<UserRecord>> => {
  const supabase = getSupabaseAdminClient();

  const payload: Record<string, unknown> = {};

  if (typeof updates.name === "string") {
    payload.name = updates.name;
  }

  if (typeof updates.email === "string") {
    payload.email = updates.email;
  }

  if (typeof updates.passwordHash === "string") {
    payload.password = updates.passwordHash;
  }

  if (typeof updates.role === "string") {
    payload.role = updates.role;
  }

  return supabase.from("user").update(payload).eq("id", id).select().single();
};

export const deleteUserById = async (
  id: number,
): Promise<PostgrestSingleResponse<UserRecord>> => {
  const supabase = getSupabaseAdminClient();

  return supabase.from("user").delete().eq("id", id).select().single();
};
