import nodemailer from "nodemailer";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

/** Gmail App Password thường có khoảng trắng — bỏ hết trước khi dùng. */
export function normalizeSmtpSecret(raw: string) {
  return raw.replace(/\s+/g, "");
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT?.trim() || "587");
  const user = process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim();
  const rawPass = process.env.SMTP_PASS?.trim() || process.env.GMAIL_APP_PASSWORD?.trim();
  const pass = rawPass ? normalizeSmtpSecret(rawPass) : undefined;
  const from =
    process.env.SMTP_FROM?.trim() ||
    (user ? `ShopInbox <${user}>` : undefined);

  if (!user || !pass || !from || !Number.isFinite(port)) {
    return null;
  }

  return { host, port, user, pass, from };
}

export function isEmailConfigured() {
  return getSmtpConfig() !== null;
}

/** Chỉ in mã OTP khi dev chủ động bật — không bao giờ in trên production. */
export function shouldLogEmailOtpCode() {
  return process.env.NODE_ENV !== "production" && process.env.EMAIL_OTP_DEV_LOG === "1";
}

/** SMTP thật, hoặc dev opt-in in mã ra console. Production bắt buộc SMTP. */
export function canSendRegisterOtp() {
  if (isEmailConfigured()) return true;
  return shouldLogEmailOtpCode();
}

/** Alias — dùng chung cho đăng ký và quên mật khẩu. */
export function canSendEmailOtp() {
  return canSendRegisterOtp();
}

/** Lỗi gửi OTP cho UI — giữ cooldown, ẩn chi tiết SMTP/server. */
export function publicOtpSendError(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : "";
  if (message.startsWith("Vui lòng đợi") || message.startsWith("Nhập sai quá nhiều lần")) {
    return message;
  }
  return fallback;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const config = getSmtpConfig();
  if (!config) {
    throw new Error("Chưa cấu hình SMTP/Gmail trên server (SMTP_USER, SMTP_PASS hoặc GMAIL_USER, GMAIL_APP_PASSWORD).");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export function buildRegisterOtpEmail(code: string) {
  const subject = "Mã xác thực đăng ký ShopInbox";
  const text = `Mã xác thực đăng ký ShopInbox của bạn là: ${code}\n\nMã có hiệu lực 10 phút. Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.`;
  const html = `
    <p>Mã xác thực đăng ký <strong>ShopInbox</strong> của bạn là:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
    <p>Mã có hiệu lực <strong>10 phút</strong>. Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.</p>
  `;
  return { subject, text, html };
}

export function buildPasswordResetOtpEmail(code: string) {
  const subject = "Mã xác minh đổi mật khẩu ShopInbox";
  const text = `Mã xác minh đổi mật khẩu ShopInbox của bạn là: ${code}\n\nMã có hiệu lực 10 phút. Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.`;
  const html = `
    <p>Mã xác minh đổi mật khẩu <strong>ShopInbox</strong> của bạn là:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
    <p>Mã có hiệu lực <strong>10 phút</strong>. Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.</p>
  `;
  return { subject, text, html };
}

export function buildProfileVerifyOtpEmail(code: string) {
  const subject = "Mã xác nhận hồ sơ ShopInbox";
  const text = `Mã xác nhận hồ sơ ShopInbox của bạn là: ${code}\n\nMã có hiệu lực 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`;
  const html = `
    <p>Mã xác nhận hồ sơ <strong>ShopInbox</strong> của bạn là:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
    <p>Mã có hiệu lực <strong>10 phút</strong>. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
  `;
  return { subject, text, html };
}
