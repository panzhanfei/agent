export type AdminMemberDto = {
  id: string;
  username: string;
  displayName: string;
  relationToPrincipal: string;
  nationalIdMasked: string;
  role: "ADMIN" | "MEMBER";
  status: "PENDING" | "ACTIVE" | "REJECTED";
  createdAt: string;
};

export type MemberStatusPatch = {
  id: string;
  username: string;
  displayName: string;
  relationToPrincipal: string;
  role: "ADMIN" | "MEMBER";
  status: "PENDING" | "ACTIVE" | "REJECTED";
};

export type PatchMemberResult =
  | { ok: true; user: MemberStatusPatch }
  | { ok: false; code: "not_found" | "self_reject" };

export type DeleteMemberResult =
  | { ok: true }
  | { ok: false; code: "not_found" | "self_delete" };
