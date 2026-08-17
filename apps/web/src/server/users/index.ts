import { UserStatus } from "@fambrain/db";
import {
  countUsers,
  deleteUserById,
  findUserId,
  listUsersForAdmin,
  updateUserStatus,
} from "@fambrain/db";
import type {
  AdminMemberDto,
  DeleteMemberResult,
  PatchMemberResult,
} from "./interface";

export type {
  AdminMemberDto,
  DeleteMemberResult,
  MemberStatusPatch,
  PatchMemberResult,
} from "./interface";

const maskNational = (id: string): string => {
  if (id.length < 10) return "****";
  return `${id.slice(0, 4)}******${id.slice(-4)}`;
};

export const isEmptyInstall = async (): Promise<boolean> =>
  (await countUsers()) === 0;

export const listAdminMembers = async (): Promise<AdminMemberDto[]> => {
  const rows = await listUsersForAdmin();
  const users: AdminMemberDto[] = rows.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    relationToPrincipal: u.relationToPrincipal,
    nationalIdMasked: maskNational(u.nationalId),
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  }));
  users.sort((a, b) => {
    const pending = { PENDING: 0, ACTIVE: 1, REJECTED: 2 } as const;
    return pending[a.status] - pending[b.status];
  });
  return users;
};

export const patchMemberStatus = async (input: {
  actorUserId: string;
  targetId: string;
  status: "ACTIVE" | "REJECTED";
}): Promise<PatchMemberResult> => {
  const target = await findUserId(input.targetId);
  if (!target) return { ok: false, code: "not_found" };
  if (target.id === input.actorUserId && input.status === "REJECTED") {
    return { ok: false, code: "self_reject" };
  }
  const next =
    input.status === "ACTIVE" ? UserStatus.ACTIVE : UserStatus.REJECTED;
  const updated = await updateUserStatus(input.targetId, next);
  return { ok: true, user: updated };
};

export const deleteMember = async (input: {
  actorUserId: string;
  targetId: string;
}): Promise<DeleteMemberResult> => {
  if (input.targetId === input.actorUserId) {
    return { ok: false, code: "self_delete" };
  }
  const target = await findUserId(input.targetId);
  if (!target) return { ok: false, code: "not_found" };
  await deleteUserById(input.targetId);
  return { ok: true };
};
