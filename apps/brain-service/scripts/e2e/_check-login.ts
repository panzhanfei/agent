import { prisma } from "@fambrain/db";
import { hashPassword, verifyPassword } from "@fambrain/auth";

const MAIN_ID = "cmp9ihokn00000mbmhwh6gn0b";

const main = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      status: true,
      passwordHash: true,
      corpusUserId: true,
    },
  });
  console.log(
    "users",
    users.map((u) => ({
      id: u.id,
      username: u.username,
      status: u.status,
      corpusUserId: u.corpusUserId,
    }))
  );

  const mainUser = users.find((x) => x.id === MAIN_ID) ?? users[0];
  if (!mainUser) throw new Error("no users");
  const okMain = await verifyPassword("12345678", mainUser.passwordHash);
  console.log("verify 12345678 for", mainUser.username, okMain);
  if (!okMain) {
    await prisma.user.update({
      where: { id: mainUser.id },
      data: { passwordHash: await hashPassword("12345678"), status: "ACTIVE" },
    });
    console.log("reset password for", mainUser.username);
  }

  let alias = await prisma.user.findUnique({
    where: { username: "panzhanfei" },
  });
  if (!alias) {
    alias = await prisma.user.create({
      data: {
        username: "panzhanfei",
        passwordHash: await hashPassword("12345678"),
        status: "ACTIVE",
        displayName: "panzhanfei",
        nationalId: "E2E000000000000000",
        relationToPrincipal: "本人-e2e",
        corpusUserId: MAIN_ID,
        role: "MEMBER",
      },
    });
    console.log("created panzhanfei → corpusUserId", MAIN_ID);
  } else {
    const ok = await verifyPassword("12345678", alias.passwordHash);
    await prisma.user.update({
      where: { id: alias.id },
      data: {
        passwordHash: ok ? undefined : await hashPassword("12345678"),
        status: "ACTIVE",
        corpusUserId: MAIN_ID,
      },
    });
    console.log("ensured panzhanfei ACTIVE → corpus", MAIN_ID, "pwOk", ok);
  }

  await prisma.$disconnect();
};

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
