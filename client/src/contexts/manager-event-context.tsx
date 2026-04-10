import { createContext, useContext, useState, type ReactNode } from "react";

interface ManagerEventContextType {
  selectedEventId: number | null;
  setSelectedEventId: (id: number | null) => void;
}

const ManagerEventContext = createContext<ManagerEventContextType | null>(null);

export function ManagerEventProvider({ children }: { children: ReactNode }) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  return (
    <ManagerEventContext.Provider value={{ selectedEventId, setSelectedEventId }}>
      {children}
    </ManagerEventContext.Provider>
  );
}

export function useManagerEvent() {
  const context = useContext(ManagerEventContext);
  if (!context) {
    throw new Error("useManagerEvent must be used within a ManagerEventProvider");
  }
  return context;
}
