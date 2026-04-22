"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";
import { UserRoleProvider } from "./context/UserRoleContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider session={undefined}>
      <UserRoleProvider>
        {children}
      </UserRoleProvider>
    </SessionProvider>
  );
}
