import { supabase } from '../../config/supabase';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// --- Types ---

export interface GroveProfile {
  id: string;
  user_id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  avatar_color: string;
  gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | null;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GrovePrivacySettings {
  id: string;
  user_id: string;
  shared_tag_ids: string[];
  share_notes: boolean;
  show_live_status: boolean;
  visible_stats: 'total_only' | 'full' | 'nothing';
  created_at: string;
  updated_at: string;
}

export interface CreateProfileInput {
  display_name: string;
  handle: string;
  avatar_color: string;
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | null;
  job_title?: string | null;
}

export interface UpdateProfileInput {
  display_name?: string;
  handle?: string;
  avatar_color?: string;
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | null;
  job_title?: string | null;
  is_active?: boolean;
}

export interface UpdatePrivacyInput {
  shared_tag_ids?: string[];
  share_notes?: boolean;
  show_live_status?: boolean;
  visible_stats?: 'total_only' | 'full' | 'nothing';
}

// --- Service ---

export const GroveService = {
  /**
   * Fetch the current user's grove profile.
   * Returns null if no profile exists.
   */
  async fetchProfile(): Promise<GroveProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('grove_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new grove profile for the current user.
   */
  async createProfile(input: CreateProfileInput): Promise<GroveProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('grove_profiles')
      .insert({
        user_id: user.id,
        display_name: input.display_name,
        handle: input.handle,
        avatar_color: input.avatar_color,
        gender: input.gender ?? null,
        job_title: input.job_title ?? null,
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate handle (unique constraint violation)
      if (error.code === '23505' && error.message?.includes('handle')) {
        throw new Error('HANDLE_TAKEN');
      }
      throw error;
    }

    return data;
  },

  /**
   * Update the current user's grove profile.
   */
  async updateProfile(input: UpdateProfileInput): Promise<GroveProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('grove_profiles')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' && error.message?.includes('handle')) {
        throw new Error('HANDLE_TAKEN');
      }
      throw error;
    }

    return data;
  },

  /**
   * Check if a handle is available (calls the RPC function).
   */
  async checkHandleAvailable(handle: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_handle_available', {
      target_handle: handle,
    });

    if (error) throw error;
    return data as boolean;
  },

  /**
   * Upload an avatar image to Supabase Storage.
   * Compresses the image to max 800x800 JPEG before uploading.
   * Returns the public URL.
   */
  async uploadAvatar(imageUri: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Compress and resize using the contextual API
    const context = ImageManipulator.manipulate(imageUri);
    const imageRef = await context.resize({ width: 800 }).renderAsync();
    const result = await imageRef.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });

    // Read the file as blob
    const response = await fetch(result.uri);
    const blob = await response.blob();

    // Convert blob to ArrayBuffer for Supabase upload
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const filePath = `${user.id}/avatar.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Append cache-buster to force refresh
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update profile with new avatar URL
    await supabase
      .from('grove_profiles')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    return publicUrl;
  },

  /**
   * Remove the current user's avatar.
   */
  async removeAvatar(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const filePath = `${user.id}/avatar.jpg`;

    await supabase.storage.from('avatars').remove([filePath]);

    await supabase
      .from('grove_profiles')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  },

  /**
   * Fetch the current user's privacy settings.
   * Returns null if no settings exist.
   */
  async fetchPrivacySettings(): Promise<GrovePrivacySettings | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('grove_privacy_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Create privacy settings for the current user.
   */
  async createPrivacySettings(input: UpdatePrivacyInput): Promise<GrovePrivacySettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('grove_privacy_settings')
      .insert({
        user_id: user.id,
        shared_tag_ids: input.shared_tag_ids ?? [],
        share_notes: input.share_notes ?? false,
        show_live_status: input.show_live_status ?? false,
        visible_stats: input.visible_stats ?? 'total_only',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update the current user's privacy settings.
   */
  async updatePrivacySettings(input: UpdatePrivacyInput): Promise<GrovePrivacySettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('grove_privacy_settings')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
