import { UserStatus } from "../generated/prisma/client";
import { prisma } from "../client";

export const countUsers = async (): Promise<number> => prisma.user.count();

export const getUserCorpusUserId = async (
  userId: string
): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { corpusUserId: true },
  });
  return user?.corpusUserId ?? null;
};

export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string;
  relationToPrincipal: string;
  nationalId: string;
  role: "ADMIN" | "MEMBER";
  status: "PENDING" | "ACTIVE" | "REJECTED";
  createdAt: Date;
};

export const listUsersForAdmin = async (): Promise<AdminUserRow[]> => {
  return prisma.user.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      username: true,
      displayName: true,
      relationToPrincipal: true,
      nationalId: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
};

export const findUserId = async (id: string): Promise<{ id: string } | null> => {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
};

export const updateUserStatus = async (id: string, status: UserStatus) => {
  return prisma.user.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      username: true,
      displayName: true,
      relationToPrincipal: true,
      role: true,
      status: true,
    },
  });
};

export const deleteUserById = async (id: string): Promise<void> => {
  await prisma.user.delete({ where: { id } });
};
