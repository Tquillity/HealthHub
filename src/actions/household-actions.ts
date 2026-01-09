'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const InviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'admin']).default('member'),
});

/**
 * Get all members of the current user's household
 */
export async function getHouseholdMembers() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get user's organization
    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    // Get all members with their user details
    const members = await prisma.member.findMany({
      where: { organizationId: membership.organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      success: true,
      data: {
        members: members.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
          joinedAt: m.createdAt,
        })),
        currentUserRole: membership.role,
        organizationId: membership.organizationId,
      },
    };
  } catch (error) {
    console.error('Error fetching household members:', error);
    return { success: false, error: 'Failed to fetch household members' };
  }
}

/**
 * Invite a new member to the household
 */
export async function inviteMember(data: z.infer<typeof InviteMemberSchema>) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const validated = InviteMemberSchema.parse(data);

    // Get user's organization
    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    // Check if user has permission to invite (owner or admin)
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return { success: false, error: 'Only owners and admins can invite members' };
    }

    // Check if email is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
      include: {
        members: {
          where: { organizationId: membership.organizationId },
        },
      },
    });

    if (existingUser && existingUser.members.length > 0) {
      return { success: false, error: 'User is already a member of this household' };
    }

    // Create invitation using Better-Auth's organization API (when available) or direct database creation.
    //
    // Note: Better-Auth's `auth.api` is plugin-shaped and can vary by version/config.
    // We feature-detect `createInvitation` to keep this action compatible even when the method
    // is not present (or not typed) and fall back to a Prisma insert.
    try {
      const api = auth.api as unknown as {
        createInvitation?: (args: {
          headers: Headers;
          body: {
            email: string;
            organizationId: string;
            role?: string;
          };
        }) => Promise<unknown>;
      };

      if (api.createInvitation) {
        const invitation = await api.createInvitation({
          headers: await headers(),
          body: {
            email: validated.email,
            organizationId: membership.organizationId,
            role: validated.role,
          },
        });

        if (invitation) {
          revalidatePath('/profile/household');
          return { success: true, data: invitation };
        }
      }
    } catch {
      // Fall through to DB-backed invitation creation
      console.log('Better-Auth invitation API not available, creating invitation directly');
    }

    // Fallback: Create invitation directly in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Invitation expires in 7 days

    const invitation = await prisma.invitation.create({
      data: {
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        organizationId: membership.organizationId,
        email: validated.email,
        role: validated.role || 'member',
        status: 'pending',
        expiresAt,
        inviterId: session.user.id,
      },
    });

    revalidatePath('/profile/household');
    return { success: true, data: invitation };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Zod v4 uses `issues` (Zod v3 used `errors`)
      return { success: false, error: error.issues?.[0]?.message || 'Validation failed' };
    }
    console.error('Error inviting member:', error);
    return { success: false, error: 'Failed to invite member' };
  }
}

/**
 * Remove a member from the household
 */
export async function removeMember(memberId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get user's organization and role
    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    // Only owners can remove members
    if (membership.role !== 'owner') {
      return { success: false, error: 'Only owners can remove members' };
    }

    // Get the member to remove
    const memberToRemove = await prisma.member.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!memberToRemove) {
      return { success: false, error: 'Member not found' };
    }

    // Prevent removing yourself
    if (memberToRemove.userId === session.user.id) {
      return { success: false, error: 'You cannot remove yourself from the household' };
    }

    // Ensure member belongs to the same organization
    if (memberToRemove.organizationId !== membership.organizationId) {
      return { success: false, error: 'Member does not belong to your household' };
    }

    // Remove the member
    await prisma.member.delete({
      where: { id: memberId },
    });

    revalidatePath('/profile/household');
    return { success: true };
  } catch (error) {
    console.error('Error removing member:', error);
    return { success: false, error: 'Failed to remove member' };
  }
}

