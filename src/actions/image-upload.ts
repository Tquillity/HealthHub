'use server';

import { z } from 'zod';

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

/**
 * Upload image file to cloud storage
 * Supports Vercel Blob (recommended) or local filesystem (development only)
 */
export async function uploadImage(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
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

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const extension = file.name.split('.').pop();
        const filename = `recipes/${timestamp}-${randomStr}.${extension}`;

        const blob = await put(filename, buffer, {
          access: 'public',
          contentType: file.type,
        });

        return { success: true, url: blob.url };
      } catch (blobError) {
        console.error('Vercel Blob upload failed:', blobError);
      }
    }

    const useLocalStorage = process.env.USE_LOCAL_STORAGE === 'true';
    if (useLocalStorage && typeof window === 'undefined') {
      try {
        const { writeFile } = await import('fs/promises');
        const { join } = await import('path');
        const { existsSync, mkdirSync } = await import('fs');

        const uploadsDir = join(process.cwd(), 'public', 'uploads', 'recipes');
        if (!existsSync(uploadsDir)) {
          mkdirSync(uploadsDir, { recursive: true });
        }

        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const extension = file.name.split('.').pop();
        const filename = `${timestamp}-${randomStr}.${extension}`;
        const filepath = join(uploadsDir, filename);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
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
