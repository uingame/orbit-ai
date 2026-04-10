import { createContext, useContext, useState, type ReactNode } from "react";

interface AdminEventContextType {
  selectedEventId: number | null;
  setSelectedEventId: (id: number | null) => void;
}

const AdminEventContext = createContext<AdminEventContextType | null>(null);

export function AdminEventProvider({ children }: { children: ReactNode }) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  return (
    <AdminEventContext.Provider value={{ selectedEventId, setSelectedEventId }}>
      {children}
    </AdminEventContext.Provider>
  );
}

export function useAdminEvent() {
  const context = useContext(AdminEventContext);
  if (!context) {
    throw new Error("useAdminEvent must be used within an AdminEventProvider");
  }
  return context;
}

/**
 * Safe variant that returns null when used outside of an AdminEventProvider.
 * Useful for pages shared between admin/manager/judge roles.
 */
export function useOptionalAdminEvent() {
  return useContext(AdminEventContext);
}
