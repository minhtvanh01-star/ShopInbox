import * as XLSX from "xlsx";
import { requirePermission } from "@/backend/rbac";
import { VARIANT_IMPORT_HEADERS } from "@/lib/product-import";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

export async function GET() {
  await requirePermission(PERMISSION_CODES.productsManage);

  const sample = [
    [...VARIANT_IMPORT_HEADERS],
    ["Size M / Đen", "AK-M-DEN", "450000", "200000", "1"],
    ["Size L / Đen", "AK-L-DEN", "460000", "200000", "1"],
    ["Size XL / Đỏ", "AK-XL-DO", "470000", "210000", "1"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(sample);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "BienThe");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="shopinbox-variant-import.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
