import { getAppEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ProjectRecord } from "@/lib/types";

export async function attachProjectLogoUrls<T extends Pick<ProjectRecord, "logo_path">>(projects: T[]) {
  const supabase = getSupabaseAdmin();
  const env = getAppEnv();

  if (!supabase || projects.length === 0) {
    return projects.map((project) => ({
      ...project,
      logo_url: null
    }));
  }

  const uniquePaths = [...new Set(projects.map((project) => project.logo_path).filter(Boolean))] as string[];

  if (uniquePaths.length === 0) {
    return projects.map((project) => ({
      ...project,
      logo_url: null
    }));
  }

  const signedEntries = await Promise.all(
    uniquePaths.map(async (path) => {
      const { data, error } = await supabase.storage.from(env.bucket).createSignedUrl(path, 60 * 60);

      if (error) {
        console.error("Failed to create signed project logo URL", error);
        return [path, null] as const;
      }

      return [path, data.signedUrl] as const;
    })
  );

  const signedUrlByPath = new Map(signedEntries);

  return projects.map((project) => ({
    ...project,
    logo_url: project.logo_path ? signedUrlByPath.get(project.logo_path) ?? null : null
  }));
}
