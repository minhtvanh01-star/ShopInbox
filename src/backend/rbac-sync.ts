import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "@/lib/rbac-catalog";

type RbacSyncClient = {
  role: {
    upsert: (args: {
      where: { code: string };
      create: {
        code: string;
        name: string;
        description: string;
        isSystem: boolean;
        isActive: boolean;
        sortOrder: number;
      };
      update: {
        name: string;
        description: string;
        isSystem: boolean;
        isActive: boolean;
        sortOrder: number;
      };
    }) => Promise<unknown>;
  };
  permission: {
    upsert: (args: {
      where: { code: string };
      create: {
        code: string;
        name: string;
        description: string;
        group: string;
      };
      update: { name: string; description: string; group: string };
    }) => Promise<unknown>;
  };
  rolePermission: {
    deleteMany: () => Promise<unknown>;
    createMany: (args: { data: Array<{ roleCode: string; permissionCode: string }> }) => Promise<unknown>;
  };
};

/** Đồng bộ roles / permissions từ catalog — không seed hội thoại demo. */
export async function syncRbacCatalog(db: RbacSyncClient) {
  for (const role of ROLES) {
    await db.role.upsert({
      where: { code: role.code },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        sortOrder: role.sortOrder,
      },
      update: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        sortOrder: role.sortOrder,
      },
    });
  }

  for (const permission of PERMISSIONS) {
    await db.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        name: permission.name,
        description: permission.description,
        group: permission.group,
      },
      update: {
        name: permission.name,
        description: permission.description,
        group: permission.group,
      },
    });
  }

  await db.rolePermission.deleteMany();
  await db.rolePermission.createMany({
    data: Object.entries(ROLE_PERMISSIONS).flatMap(([roleCode, codes]) =>
      codes.map((permissionCode) => ({ roleCode, permissionCode })),
    ),
  });
}
