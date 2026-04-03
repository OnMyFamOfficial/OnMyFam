import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface MobileMenuItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}

interface MobileMenuContextType {
  menuItems: MobileMenuItem[] | null;
  setMenuItems: (items: MobileMenuItem[] | null) => void;
  clearMenu: () => void;
}

const MobileMenuContext = createContext<MobileMenuContextType>({
  menuItems: null,
  setMenuItems: () => {},
  clearMenu: () => {},
});

export const useMobileMenu = () => useContext(MobileMenuContext);

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [menuItems, setMenuItems] = useState<MobileMenuItem[] | null>(null);
  const clearMenu = useCallback(() => setMenuItems(null), []);

  return (
    <MobileMenuContext.Provider value={{ menuItems, setMenuItems, clearMenu }}>
      {children}
    </MobileMenuContext.Provider>
  );
}
