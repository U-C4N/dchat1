import { supabase } from './client';

export interface UploadImageResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export interface ImageAttachment {
  file: File;
  url: string;
  id: string;
}

// Resim dosyalarını upload etmek için fonksiyon
export async function uploadImage(file: File, sessionId: string): Promise<UploadImageResult> {
  try {
    // Dosya boyutu kontrolü (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return {
        success: false,
        error: 'Dosya boyutu 5MB\'dan büyük olamaz'
      };
    }

    // MIME type kontrolü
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Sadece JPEG, PNG, GIF ve WebP formatları destekleniyor'
      };
    }

    // Unique dosya adı oluştur
    const fileExt = file.name.split('.').pop();
    const fileName = `${sessionId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

    // Dosyayı Supabase Storage'a yükle
    const { data, error } = await supabase.storage
      .from('attachments')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      return {
        success: false,
        error: 'Dosya yüklenirken hata oluştu: ' + error.message
      };
    }

    // Public URL'i al
    const { data: urlData } = supabase.storage
      .from('attachments')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      console.error('Public URL creation failed');
      // Storage'dan dosyayı sil
      await supabase.storage.from('attachments').remove([fileName]);
      return {
        success: false,
        error: 'URL oluşturulamadı'
      };
    }

    // Attachment bilgisini veritabanına kaydet
    const { error: dbError } = await supabase
      .from('chat_attachments')
      .insert({
        session_id: sessionId,
        file_path: fileName,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type
      });

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Storage'dan dosyayı sil
      await supabase.storage.from('attachments').remove([fileName]);
      return {
        success: false,
        error: 'Veritabanı hatası: ' + dbError.message
      };
    }

    return {
      success: true,
      url: urlData.publicUrl,
      path: fileName
    };

  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: 'Beklenmedik hata oluştu'
    };
  }
}

// Session silindiğinde tüm attachments'ları sil
export async function deleteSessionAttachments(sessionId: string): Promise<boolean> {
  try {
    // Session'a ait tüm attachments'ları al
    const { data: attachments, error: fetchError } = await supabase
      .from('chat_attachments')
      .select('file_path')
      .eq('session_id', sessionId);

    if (fetchError) {
      console.error('Fetch attachments error:', fetchError);
      return false;
    }

    if (attachments && attachments.length > 0) {
      // Storage'dan dosyaları sil
      const filePaths = attachments.map(att => att.file_path);
      const { error: storageError } = await supabase.storage
        .from('attachments')
        .remove(filePaths);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Veritabanından kayıtları sil
      const { error: dbError } = await supabase
        .from('chat_attachments')
        .delete()
        .eq('session_id', sessionId);

      if (dbError) {
        console.error('Database delete error:', dbError);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Delete session attachments error:', error);
    return false;
  }
}

// File validation helper
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Sadece JPEG, PNG, GIF ve WebP formatları destekleniyor'
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Dosya boyutu 5MB\'dan büyük olamaz'
    };
  }

  return { valid: true };
}

// Create preview URL for uploaded file
export function createFilePreview(file: File): string {
  return URL.createObjectURL(file);
} 