import { prisma } from "@/backend/prisma";
import {
  buildPasswordResetOtpEmail,
  buildRegisterOtpEmail,
  canSendRegisterOtp,
  isEmailConfigured,
  sendEmail,
  shouldLogEmailOtpCode,
} from "@/backend/email";
import {
  EMAIL_OTP_LOCKOUT_MS,
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_PURPOSE_PASSWORD_RESET,
  EMAIL_OTP_PURPOSE_REGISTER,
  EMAIL_OTP_RESEND_COOLDOWN_MS,
  EMAIL_OTP_TTL_MS,
  emailOtpCodesEqual,
  generateEmailOtpCode,
  hashEmailOtpCode,
  parsePasswordResetOtpPayload,
  parseRegisterOtpPayload,
  type PasswordResetOtpPayload,
  type RegisterOtpPayload,
} from "@/backend/email-otp-code";

export {
  EMAIL_OTP_CODE_LENGTH,
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_PURPOSE_PASSWORD_RESET,
  EMAIL_OTP_PURPOSE_REGISTER,
  EMAIL_OTP_RESEND_COOLDOWN_MS,
  EMAIL_OTP_TTL_MS,
  generateEmailOtpCode,
  hashEmailOtpCode,
  parsePasswordResetOtpPayload,
  parseRegisterOtpPayload,
  type PasswordResetOtpPayload,
  type RegisterOtpPayload,
} from "@/backend/email-otp-code";

function assertOtpSendAllowed(existing: { attempts: number; lastSentAt: Date } | null) {
  if (!existing) return;
  const elapsed = Date.now() - existing.lastSentAt.getTime();
  if (existing.attempts >= EMAIL_OTP_MAX_ATTEMPTS && elapsed < EMAIL_OTP_LOCKOUT_MS) {
    throw new Error("Nhập sai quá nhiều lần. Vui lòng đợi rồi thử lại.");
  }
  if (elapsed < EMAIL_OTP_RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((EMAIL_OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
    throw new Error(`Vui lòng đợi ${waitSec}s trước khi gửi lại mã.`);
  }
}

export async function createRegisterEmailOtp(input: {
  email: string;
  name: string;
  passwordHash: string;
}) {
  if (!canSendRegisterOtp()) {
    throw new Error(
      "Chưa cấu hình gửi email. Điền GMAIL_USER + GMAIL_APP_PASSWORD (hoặc SMTP_*) trong .env rồi restart.",
    );
  }

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.emailOtpChallenge.findFirst({
    where: { email, purpose: EMAIL_OTP_PURPOSE_REGISTER },
    orderBy: { lastSentAt: "desc" },
  });

  assertOtpSendAllowed(existing);

  const code = generateEmailOtpCode();
  const codeHash = hashEmailOtpCode(code, { purpose: EMAIL_OTP_PURPOSE_REGISTER, email });
  const payloadJson = JSON.stringify({
    name: input.name,
    passwordHash: input.passwordHash,
  } satisfies RegisterOtpPayload);
  const expiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);

  // Gửi trước khi ghi DB — mail fail thì challenge cũ vẫn còn, không orphan mã mới.
  if (isEmailConfigured()) {
    const mail = buildRegisterOtpEmail(code);
    await sendEmail({ to: email, ...mail });
  }

  if (shouldLogEmailOtpCode()) {
    console.info(`[email-otp] register code for ${email}: ${code}`);
  }

  await prisma.emailOtpChallenge.deleteMany({
    where: { email, purpose: EMAIL_OTP_PURPOSE_REGISTER },
  });

  await prisma.emailOtpChallenge.create({
    data: {
      email,
      purpose: EMAIL_OTP_PURPOSE_REGISTER,
      codeHash,
      payloadJson,
      expiresAt,
    },
  });

  return { email, expiresAt };
}

export type VerifyRegisterOtpResult =
  | { ok: true; email: string; payload: RegisterOtpPayload; challengeId: string }
  | { ok: false; error: string };

export async function verifyRegisterEmailOtp(input: {
  email: string;
  code: string;
}): Promise<VerifyRegisterOtpResult> {
  const email = input.email.trim().toLowerCase();
  const code = input.code.trim();

  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Mã xác thực gồm 6 chữ số." };
  }

  const challenge = await prisma.emailOtpChallenge.findFirst({
    where: { email, purpose: EMAIL_OTP_PURPOSE_REGISTER },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    return { ok: false, error: "Chưa có mã xác thực. Hãy gửi lại mã từ form đăng ký." };
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    await prisma.emailOtpChallenge.delete({ where: { id: challenge.id } });
    return { ok: false, error: "Mã đã hết hạn. Hãy đăng ký lại để nhận mã mới." };
  }

  if (challenge.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Nhập sai quá nhiều lần. Vui lòng đợi rồi gửi lại mã." };
  }

  const expected = hashEmailOtpCode(code, { purpose: EMAIL_OTP_PURPOSE_REGISTER, email });
  const ok = emailOtpCodesEqual(challenge.codeHash, expected);
  if (!ok) {
    const claimed = await prisma.emailOtpChallenge.updateMany({
      where: { id: challenge.id, attempts: { lt: EMAIL_OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      return { ok: false, error: "Nhập sai quá nhiều lần. Vui lòng đợi rồi gửi lại mã." };
    }
    return { ok: false, error: "Mã xác thực không đúng." };
  }

  const payload = parseRegisterOtpPayload(challenge.payloadJson);
  if (!payload) {
    await prisma.emailOtpChallenge.delete({ where: { id: challenge.id } });
    return { ok: false, error: "Phiên đăng ký không hợp lệ. Hãy thử lại." };
  }

  // Giữ challenge tới khi tạo staff thành công (consumeRegisterEmailOtp).
  return { ok: true, email, payload, challengeId: challenge.id };
}

export async function consumeRegisterEmailOtp(challengeId: string) {
  await prisma.emailOtpChallenge.deleteMany({ where: { id: challengeId } });
}

export async function discardRegisterEmailOtp(email: string) {
  await prisma.emailOtpChallenge.deleteMany({
    where: { email: email.trim().toLowerCase(), purpose: EMAIL_OTP_PURPOSE_REGISTER },
  });
}

export async function createPasswordResetEmailOtp(input: {
  email: string;
  passwordHash: string;
}) {
  if (!canSendRegisterOtp()) {
    throw new Error(
      "Chưa cấu hình gửi email. Điền GMAIL_USER + GMAIL_APP_PASSWORD (hoặc SMTP_*) trong .env rồi restart.",
    );
  }

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.emailOtpChallenge.findFirst({
    where: { email, purpose: EMAIL_OTP_PURPOSE_PASSWORD_RESET },
    orderBy: { lastSentAt: "desc" },
  });

  assertOtpSendAllowed(existing);

  const code = generateEmailOtpCode();
  const codeHash = hashEmailOtpCode(code, {
    purpose: EMAIL_OTP_PURPOSE_PASSWORD_RESET,
    email,
  });
  const payloadJson = JSON.stringify({
    passwordHash: input.passwordHash,
  } satisfies PasswordResetOtpPayload);
  const expiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);

  if (isEmailConfigured()) {
    const mail = buildPasswordResetOtpEmail(code);
    await sendEmail({ to: email, ...mail });
  }

  if (shouldLogEmailOtpCode()) {
    console.info(`[email-otp] password_reset code for ${email}: ${code}`);
  }

  await prisma.emailOtpChallenge.deleteMany({
    where: { email, purpose: EMAIL_OTP_PURPOSE_PASSWORD_RESET },
  });

  await prisma.emailOtpChallenge.create({
    data: {
      email,
      purpose: EMAIL_OTP_PURPOSE_PASSWORD_RESET,
      codeHash,
      payloadJson,
      expiresAt,
    },
  });

  return { email, expiresAt };
}

export type VerifyPasswordResetOtpResult =
  | { ok: true; email: string; payload: PasswordResetOtpPayload; challengeId: string }
  | { ok: false; error: string };

export async function verifyPasswordResetEmailOtp(input: {
  email: string;
  code: string;
}): Promise<VerifyPasswordResetOtpResult> {
  const email = input.email.trim().toLowerCase();
  const code = input.code.trim();

  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Mã xác minh gồm 6 chữ số." };
  }

  const challenge = await prisma.emailOtpChallenge.findFirst({
    where: { email, purpose: EMAIL_OTP_PURPOSE_PASSWORD_RESET },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    return { ok: false, error: "Chưa có mã xác minh. Hãy gửi lại mã từ form quên mật khẩu." };
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    await prisma.emailOtpChallenge.delete({ where: { id: challenge.id } });
    return { ok: false, error: "Mã đã hết hạn. Hãy yêu cầu mã mới." };
  }

  if (challenge.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Nhập sai quá nhiều lần. Vui lòng đợi rồi gửi lại mã." };
  }

  const expected = hashEmailOtpCode(code, {
    purpose: EMAIL_OTP_PURPOSE_PASSWORD_RESET,
    email,
  });
  const ok = emailOtpCodesEqual(challenge.codeHash, expected);
  if (!ok) {
    const claimed = await prisma.emailOtpChallenge.updateMany({
      where: { id: challenge.id, attempts: { lt: EMAIL_OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      return { ok: false, error: "Nhập sai quá nhiều lần. Vui lòng đợi rồi gửi lại mã." };
    }
    return { ok: false, error: "Mã xác minh không đúng." };
  }

  const payload = parsePasswordResetOtpPayload(challenge.payloadJson);
  if (!payload) {
    await prisma.emailOtpChallenge.delete({ where: { id: challenge.id } });
    return { ok: false, error: "Phiên đổi mật khẩu không hợp lệ. Hãy thử lại." };
  }

  return { ok: true, email, payload, challengeId: challenge.id };
}

export async function consumePasswordResetEmailOtp(challengeId: string) {
  await prisma.emailOtpChallenge.deleteMany({ where: { id: challengeId } });
}

export async function discardPasswordResetEmailOtp(email: string) {
  await prisma.emailOtpChallenge.deleteMany({
    where: {
      email: email.trim().toLowerCase(),
      purpose: EMAIL_OTP_PURPOSE_PASSWORD_RESET,
    },
  });
}
