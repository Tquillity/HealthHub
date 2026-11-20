/**
 * Image uploads go through a Server Action, so the file must fit in the action's request body.
 * Vercel caps function request bodies at 4.5 MB, and next.config.ts raises Next's own
 * Server Action limit (1 MB by default) to SERVER_ACTION_BODY_LIMIT to match.
 */
export const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_LABEL = '4 MB';
/** Room for the multipart envelope around a MAX_IMAGE_UPLOAD_BYTES file. */
export const SERVER_ACTION_BODY_LIMIT = '4.4mb';
