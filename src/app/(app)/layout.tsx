import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { getShopContext } from "@/lib/queries";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const shop = await getShopContext();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar
        shopName={shop.shopName}
        staffName={shop.staffName}
        roleLabel={shop.roleLabel}
        isOwner={shop.role === "owner"}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
