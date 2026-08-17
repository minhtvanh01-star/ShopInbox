import { CustomersWorkspace } from "@/components/customers/CustomersWorkspace";
import { requirePermission } from "@/backend/rbac";
import { getCustomersPageData } from "@/lib/queries";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

export default async function CustomersPage() {
  await requirePermission(PERMISSION_CODES.customersRead);
  const customers = await getCustomersPageData();

  return <CustomersWorkspace customers={customers} />;
}
