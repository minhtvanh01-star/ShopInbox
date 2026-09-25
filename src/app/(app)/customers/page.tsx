import { CustomersWorkspace } from "@/components/customers/CustomersWorkspace";
import { requirePermission, getPermissionCodes } from "@/backend/rbac";
import { getCustomersPageData } from "@/lib/queries";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

export default async function CustomersPage() {
  const session = await requirePermission(PERMISSION_CODES.customersRead);
  const [customers, permissions] = await Promise.all([
    getCustomersPageData(),
    getPermissionCodes(session),
  ]);

  return (
    <CustomersWorkspace
      customers={customers}
      canMerge={permissions.includes(PERMISSION_CODES.customersUpdate)}
    />
  );
}
