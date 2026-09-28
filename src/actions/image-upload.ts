'use server';

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireSessionUserId } from '@/lib/session';

const FileSchema = z.custom<File>(
  (val) => val instanceof File,
  { message: 'Must be a File' }
);

const AllowedMimeSchema = z.enum([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MaxFileSizeSchema = z.number().max(5 * 1024 * 1024);

/** The stored extension comes from the validated MIME type, never from the client filename. */
const EXTENSION_BY_MIME: Record<z.infer<typeof AllowedMimeSchema>, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Checks the file's magic bytes so a renamed HTML/SVG payload cannot pass as an image. */
function hasImageSignature(bytes: Uint8Array, mime: z.infer<typeof AllowedMimeSchema>): boolean {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return startsWith([0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/gif':
      return startsWith([0x47, 0x49, 0x46, 0x38]);
    case 'image/webp':
      return startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8);
  }
}

/**
 * Upload image file to cloud storage
 * Supports Vercel Blob (recommended) or local filesystem (development only)
 */
export async function uploadImage(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const fileResult = FileSchema.safeParse(formData.get('file'));
    if (!fileResult.success) {
      return { success: false, error: 'No file provided' };
    }
    const file = fileResult.data;

    const mimeResult = AllowedMimeSchema.safeParse(file.type);
    if (!mimeResult.success) {
      return { success: false, error: 'Invalid file type. Only images are allowed.' };
    }

    const sizeResult = MaxFileSizeSchema.safeParse(file.size);
    if (!sizeResult.success) {
      return { success: false, error: 'File size exceeds 5MB limit.' };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasImageSignature(buffer, mimeResult.data)) {
      return { success: false, error: 'Invalid file type. Only images are allowed.' };
    }
    const filename = `${Date.now()}-${randomUUID()}.${EXTENSION_BY_MIME[mimeResult.data]}`;

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      try {
        const runtimeImport = new Function(
          'm',
          'return import(m)',
        ) as unknown as (moduleName: string) => Promise<unknown>;

        const vercelBlob = (await runtimeImport('@vercel/blob')) as {
          put: (
            pathname: string,
            body: Buffer,
            options: { access: 'public' | 'private'; contentType?: string },
          ) => Promise<{ url: string }>;
        };

        const { put } = vercelBlob;

        const blob = await put(`recipes/${filename}`, buffer, {
          access: 'public',
          contentType: mimeResult.data,
        });

        return { success: true, url: blob.url };
      } catch (blobError) {
        console.error('Vercel Blob upload failed:', blobError);
      }
    }

    // Local filesystem uploads are a development convenience only
    const useLocalStorage =
      process.env.USE_LOCAL_STORAGE === 'true' && process.env.NODE_ENV !== 'production';
    if (useLocalStorage && typeof window === 'undefined') {
      try {
        const { writeFile } = await import('fs/promises');
        const { join } = await import('path');
        const { existsSync, mkdirSync } = await import('fs');

        const uploadsDir = join(process.cwd(), 'public', 'uploads', 'recipes');
        if (!existsSync(uploadsDir)) {
          mkdirSync(uploadsDir, { recursive: true });
        }

        const filepath = join(uploadsDir, filename);
        await writeFile(filepath, buffer);

        return { success: true, url: `/uploads/recipes/${filename}` };
      } catch (localError) {
        console.error('Local storage upload failed:', localError);
        return {
          success: false,
          error:
            'Image upload failed. Please configure Vercel Blob or use local storage in development.',
        };
      }
    }

    return {
      success: false,
      error:
        'Image upload not configured. Please set BLOB_READ_WRITE_TOKEN or USE_LOCAL_STORAGE=true for development.',
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    return { success: false, error: 'Failed to upload image' };
  }
}
