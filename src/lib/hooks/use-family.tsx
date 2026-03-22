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

    if (famList.length > 0) {
      const saved = localStorage.getItem("omf-current-family");
      const current = currentFamily ? famList.find((f) => f.id === currentFamily.id) : null;
      const found = saved ? famList.find((f) => f.id === saved) : null;
      setCurrentFamily(current || found || famList[0]);
    }

    setLoading(false);
  }

  async function refreshMembers() {
    if (!currentFamily) {
      setMembers([]);
      setMyMembership(null);
      return;
    }

    const { data, error: memError } = await supabase
      .from("family_members")
      .select("*")
      .eq("family_id", currentFamily.id);

    console.log("[useFamily] members raw:", data, "error:", memError);

    if (!data || data.length === 0) {
      setMembers([]);
      setMyMembership(null);
      return;
    }

    // Fetch profiles separately to avoid join issues
    const userIds = data.map((m) => m.user_id);
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    const profileMap = new Map<string, Profile>();
    for (const p of (profilesData || []) as Profile[]) {
      profileMap.set(p.id, p);
    }

    const memberList = (data as FamilyMember[]).map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) || { id: m.user_id, display_name: "Unknown", avatar_url: null } as Profile,
    })).sort((a, b) => {
      // 1. Role priority: admin > moderator > member
      const rolePriority: Record<string, number> = { admin: 0, moderator: 1, member: 2 };
      const roleA = rolePriority[a.role] ?? 2;
      const roleB = rolePriority[b.role] ?? 2;
      if (roleA !== roleB) return roleA - roleB;
      // 2. Alphabetical by display name
      return (a.profile.display_name || "").localeCompare(b.profile.display_name || "");
    });
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
