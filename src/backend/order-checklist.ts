import { prisma } from "@/backend/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  CHECKLIST_MAX_PER_SHOP,
  DEFAULT_ORDER_CHECKLIST_LABELS,
  parseChecklistTemplateInput,
} from "@/lib/order-checklist";

type ChecklistDb = Prisma.TransactionClient | typeof prisma;

export async function listChecklistTemplates(
  shopId: string,
  opts?: { enabledOnly?: boolean; db?: ChecklistDb },
) {
  const db = opts?.db ?? prisma;
  return db.orderChecklistTemplate.findMany({
    where: {
      shopId,
      ...(opts?.enabledOnly ? { enabled: true } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

export async function ensureDefaultChecklistTemplates(shopId: string, db: ChecklistDb = prisma) {
  const count = await db.orderChecklistTemplate.count({ where: { shopId } });
  if (count > 0) {
    return listChecklistTemplates(shopId, { db });
  }

  await db.orderChecklistTemplate.createMany({
    data: DEFAULT_ORDER_CHECKLIST_LABELS.map((label, index) => ({
      id: `oct-${crypto.randomUUID()}`,
      shopId,
      label,
      sortOrder: index,
      enabled: true,
    })),
  });

  return listChecklistTemplates(shopId, { db });
}

export async function createChecklistTemplate(
  shopId: string,
  raw: { label?: string; enabled?: string | boolean; sortOrder?: string | number },
) {
  const parsed = parseChecklistTemplateInput(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const count = await prisma.orderChecklistTemplate.count({ where: { shopId } });
  if (count >= CHECKLIST_MAX_PER_SHOP) {
    throw new Error(`Mỗi shop tối đa ${CHECKLIST_MAX_PER_SHOP} mục checklist.`);
  }

  const sortOrder =
    raw.sortOrder === undefined || raw.sortOrder === null || raw.sortOrder === ""
      ? count
      : parsed.value.sortOrder;

  return prisma.orderChecklistTemplate.create({
    data: {
      id: `oct-${crypto.randomUUID()}`,
      shopId,
      label: parsed.value.label,
      enabled: parsed.value.enabled,
      sortOrder,
    },
  });
}

export async function updateChecklistTemplate(
  shopId: string,
  id: string,
  raw: { label?: string; enabled?: string | boolean; sortOrder?: string | number },
) {
  const parsed = parseChecklistTemplateInput(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const existing = await prisma.orderChecklistTemplate.findFirst({ where: { id, shopId } });
  if (!existing) {
    throw new Error("Không tìm thấy mục checklist.");
  }

  return prisma.orderChecklistTemplate.update({
    where: { id },
    data: {
      label: parsed.value.label,
      enabled: parsed.value.enabled,
      sortOrder: parsed.value.sortOrder,
    },
  });
}

export async function deleteChecklistTemplate(shopId: string, id: string) {
  const existing = await prisma.orderChecklistTemplate.findFirst({ where: { id, shopId } });
  if (!existing) {
    throw new Error("Không tìm thấy mục checklist.");
  }
  await prisma.orderChecklistTemplate.delete({ where: { id } });
  return existing;
}

/** Gắn checklist (chưa tick) vào đơn mới theo template đang bật. */
export async function attachChecklistToOrder(
  shopId: string,
  orderId: string,
  db: ChecklistDb = prisma,
) {
  await ensureDefaultChecklistTemplates(shopId, db);
  const templates = await listChecklistTemplates(shopId, { enabledOnly: true, db });
  if (templates.length === 0) {
    return [];
  }

  await db.orderChecklistCheck.createMany({
    data: templates.map((template) => ({
      id: `occ-${crypto.randomUUID()}`,
      orderId,
      templateId: template.id,
      done: false,
    })),
    skipDuplicates: true,
  });

  return listOrderChecklist(orderId, db);
}

export async function listOrderChecklist(orderId: string, db: ChecklistDb = prisma) {
  const rows = await db.orderChecklistCheck.findMany({
    where: { orderId },
    include: { template: true },
  });
  return rows.sort((a, b) => {
    const aOrder = a.template?.sortOrder ?? 0;
    const bOrder = b.template?.sortOrder ?? 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.template?.label ?? "").localeCompare(b.template?.label ?? "");
  });
}

/** Đơn cũ chưa có checklist — gắn các mục đang bật (idempotent nếu đã có). */
export async function ensureChecklistOnOrder(shopId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    select: { id: true },
  });
  if (!order) {
    throw new Error("Không tìm thấy đơn.");
  }

  const existing = await prisma.orderChecklistCheck.count({ where: { orderId } });
  if (existing > 0) {
    return listOrderChecklist(orderId);
  }
  return attachChecklistToOrder(shopId, orderId);
}

export async function setOrderChecklistDone(input: {
  shopId: string;
  orderId: string;
  checkId: string;
  done: boolean;
  staffId: string;
}) {
  const check = await prisma.orderChecklistCheck.findFirst({
    where: {
      id: input.checkId,
      orderId: input.orderId,
      order: { shopId: input.shopId },
    },
    include: {
      template: true,
      order: { select: { code: true } },
    },
  });
  if (!check) {
    throw new Error("Không tìm thấy mục checklist trên đơn.");
  }

  const updated = await prisma.orderChecklistCheck.update({
    where: { id: check.id },
    data: input.done
      ? { done: true, doneAt: new Date(), doneByStaffId: input.staffId }
      : { done: false, doneAt: null, doneByStaffId: null },
    include: { template: true },
  });

  return {
    check: updated,
    orderCode: check.order.code,
    from: check.done,
    to: updated.done,
    label: check.template?.label ?? "Mục checklist",
  };
}
