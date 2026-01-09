'use server';

/**
 * Upload image file to cloud storage
 * Supports Vercel Blob (recommended) or local filesystem (development only)
 * 
 * Setup Instructions:
 * 
 * Option 1: Vercel Blob (Recommended for Production)
 * 1. Install: pnpm add @vercel/blob
 * 2. Get token from Vercel Dashboard > Settings > Storage > Blob
 * 3. Add to .env: BLOB_READ_WRITE_TOKEN=your_token_here
 * 
 * Option 2: Local Filesystem (Development Only - NOT for Serverless)
 * - Works locally but will fail on Vercel/Serverless
 * - Set USE_LOCAL_STORAGE=true in .env for local dev
 */
export async function uploadImage(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get('file') as File;
    
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Invalid file type. Only images are allowed.' };
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { success: false, error: 'File size exceeds 5MB limit.' };
    }

    // Try Vercel Blob first (if available)
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      try {
        // IMPORTANT:
        // Next.js/webpack can try to resolve static `import('@vercel/blob')` at build time (even inside try/catch),
        // which would fail builds when `@vercel/blob` is not installed.
        //
        // We intentionally use an *un-analyzable* runtime import so this remains an optional dependency:
        // - If `@vercel/blob` is installed, the import succeeds and we upload to Blob.
        // - If it is NOT installed, this throws and we fall back to local storage (dev) or a clear error message.
        const runtimeImport = new Function(
          'm',
          'return import(m)',
        ) as unknown as (moduleName: string) => Promise<unknown>;

        // Do not reference `import('@vercel/blob')` types here; the module is optional and may not be installed.
        // We only rely on the minimal `put()` contract we need.
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
        
        // Generate unique filename
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
        // Fall through to local storage if configured
      }
    }

    // Fallback: Local filesystem (development only - NOT for serverless)
    const useLocalStorage = process.env.USE_LOCAL_STORAGE === 'true';
    if (useLocalStorage && typeof window === 'undefined') {
      // Only use in Node.js environment (not in browser)
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
          error: 'Image upload failed. Please configure Vercel Blob or use local storage in development.' 
        };
      }
    }

    // No storage backend configured
    return { 
      success: false, 
      error: 'Image upload not configured. Please set BLOB_READ_WRITE_TOKEN or USE_LOCAL_STORAGE=true for development.' 
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    return { success: false, error: 'Failed to upload image' };
  }
}

