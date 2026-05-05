import { attachProjectLogoUrls } from "@/lib/data/project-assets";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ProjectRecord } from "@/lib/types";

export async function getProjects() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return [] satisfies ProjectRecord[];
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load projects", error);
    return [] satisfies ProjectRecord[];
  }

  return attachProjectLogoUrls(data as ProjectRecord[]);
}
