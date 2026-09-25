-- Checklist vận hành đơn: template theo shop + tick trên từng đơn
CREATE TABLE "order_checklist_templates" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "order_checklist_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_checklist_checks" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "doneByStaffId" TEXT,

    CONSTRAINT "order_checklist_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_checklist_templates_shopId_sortOrder_idx" ON "order_checklist_templates"("shopId", "sortOrder");

CREATE UNIQUE INDEX "order_checklist_checks_orderId_templateId_key" ON "order_checklist_checks"("orderId", "templateId");

CREATE INDEX "order_checklist_checks_templateId_idx" ON "order_checklist_checks"("templateId");

CREATE INDEX "order_checklist_checks_doneByStaffId_idx" ON "order_checklist_checks"("doneByStaffId");

ALTER TABLE "order_checklist_templates" ADD CONSTRAINT "order_checklist_templates_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_checklist_checks" ADD CONSTRAINT "order_checklist_checks_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_checklist_checks" ADD CONSTRAINT "order_checklist_checks_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "order_checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_checklist_checks" ADD CONSTRAINT "order_checklist_checks_doneByStaffId_fkey" FOREIGN KEY ("doneByStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
