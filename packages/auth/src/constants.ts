export const AUTH_COOKIE_NAME = "fambrain_token";
export const TOKEN_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 天
export const authCookieOptions = () => {
    // 本地 http E2E：设 AUTH_COOKIE_SECURE=0，避免 Secure cookie 在 http://127.0.0.1 被丢弃
    const forceInsecure = process.env.AUTH_COOKIE_SECURE?.trim() === "0";
    return {
        httpOnly: true as const,
        sameSite: "lax" as const,
        path: "/" as const,
        maxAge: TOKEN_MAX_AGE_SEC,
        secure: forceInsecure ? false : process.env.NODE_ENV === "production",
    };
};
export const membershipAuditNationalIdSuffix = (): string => {
    const fromEnv = process.env.FAMBRAIN_MEMBERSHIP_AUDIT_ID_SUFFIX?.trim();
    if (fromEnv)
        return fromEnv.toUpperCase();
    return "03261674";
};
export const nationalIdHasMembershipAuditPrivilege = (nationalId: string): boolean => {
    const suf = membershipAuditNationalIdSuffix();
    if (!suf)
        return false;
    return nationalId.trim().toUpperCase().endsWith(suf.toUpperCase());
};
