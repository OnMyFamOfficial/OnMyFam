import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import type { Family, FamilyMember, Profile } from "@/lib/types";

interface FamilyContextType {
  families: Family[];
  currentFamily: Family | null;
  members: (FamilyMember & { profile: Profile })[];
  myMembership: FamilyMember | null;
  loading: boolean;
  setCurrentFamily: (family: Family) => void;
  refreshFamilies: () => Promise<void>;
  refreshMembers: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [currentFamily, setCurrentFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<(FamilyMember & { profile: Profile })[]>([]);
  const [myMembership, setMyMembership] = useState<FamilyMember | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshFamilies() {
    if (!user) return;

    const { data: memberships, error: memErr } = await supabase
      .from("family_members")
      .select("family_id")
      .eq("user_id", user.id);

    console.log("[useFamily] memberships:", memberships, "error:", memErr);

    if (!memberships || memberships.length === 0) {
      setFamilies([]);
      setCurrentFamily(null);
      setLoading(false);
      return;
    }

    const familyIds = memberships.map((m) => m.family_id);
    const { data: fams } = await supabase
      .from("families")
      .select("*")
      .in("id", familyIds);

    const famList = (fams || []) as Family[];
    setFamilies(famList);

    if (famList.length > 0 && !currentFamily) {
      const saved = localStorage.getItem("omf-current-family");
      const found = saved ? famList.find((f) => f.id === saved) : null;
      setCurrentFamily(found || famList[0]);
    }

    setLoading(false);
  }

  async function refreshMembers() {
    if (!currentFamily) {
      setMembers([]);
      setMyMembership(null);
      return;
    }

    const { data } = await supabase
      .from("family_members")
      .select("*, profile:profiles(*)")
      .eq("family_id", currentFamily.id);

    const memberList = (data || []) as (FamilyMember & { profile: Profile })[];
    setMembers(memberList);

    if (user) {
      const mine = memberList.find((m) => m.user_id === user.id) || null;
      setMyMembership(mine);
    }
  }

  useEffect(() => {
    if (user) {
      refreshFamilies();
    } else {
      setFamilies([]);
      setCurrentFamily(null);
      setMembers([]);
      setMyMembership(null);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (currentFamily) {
      localStorage.setItem("omf-current-family", currentFamily.id);
      refreshMembers();
    }
  }, [currentFamily]);

  function handleSetCurrentFamily(family: Family) {
    setCurrentFamily(family);
  }

  return (
    <FamilyContext.Provider
      value={{
        families,
        currentFamily,
        members,
        myMembership,
        loading,
        setCurrentFamily: handleSetCurrentFamily,
        refreshFamilies,
        refreshMembers,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error("useFamily must be used within a FamilyProvider");
  }
  return context;
}
