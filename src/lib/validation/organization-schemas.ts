import { z } from 'zod';

/** An organization (space) id sent by the client, for example the space a page was rendered for. */
export const OrganizationIdSchema = z.string().trim().min(1).max(128);
