"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAppEnv } from "@/lib/env";
import { slugifyProjectName } from "@/lib/slug";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function createProjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || null;
  const logo = formData.get("logo");
  const supabase = getSupabaseAdmin();
  const env = getAppEnv();

  if (!name) {
    throw new Error("Project name is required.");
  }

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const slug = slugifyProjectName(name);
  let logoPath: string | null = null;

  if (logo instanceof File && logo.size > 0) {
    if (!logo.type.startsWith("image/")) {
      throw new Error("Project logo must be an image file.");
    }

    const extension = logo.name.split(".").pop()?.toLowerCase() || "png";
    logoPath = `projects/logos/${randomUUID()}.${extension}`;

    const uploadResult = await supabase.storage.from(env.bucket).upload(logoPath, await logo.arrayBuffer(), {
      contentType: logo.type,
      upsert: false
    });

    if (uploadResult.error) {
      throw new Error(uploadResult.error.message);
    }
  }

  const { error } = await supabase.from("projects").insert({
    name,
    slug,
    color,
    logo_path: logoPath
  });

  if (error) {
    if (logoPath) {
      await supabase.storage.from(env.bucket).remove([logoPath]);
    }

    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath("/posts/new");
  revalidatePath("/projects");
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || null;
  const logo = formData.get("logo");
  const removeLogo = String(formData.get("removeLogo") ?? "") === "on";
  const supabase = getSupabaseAdmin();
  const env = getAppEnv();

  if (!name) {
    throw new Error("Project name is required.");
  }

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: existingProject, error: fetchError } = await supabase
    .from("projects")
    .select("id, logo_path")
    .eq("id", projectId)
    .single();

  if (fetchError || !existingProject) {
    throw new Error("Project not found.");
  }

  let nextLogoPath = existingProject.logo_path ?? null;

  if (removeLogo) {
    nextLogoPath = null;
  }

  if (logo instanceof File && logo.size > 0) {
    if (!logo.type.startsWith("image/")) {
      throw new Error("Project logo must be an image file.");
    }

    const extension = logo.name.split(".").pop()?.toLowerCase() || "png";
    nextLogoPath = `projects/logos/${randomUUID()}.${extension}`;

    const uploadResult = await supabase.storage.from(env.bucket).upload(nextLogoPath, await logo.arrayBuffer(), {
      contentType: logo.type,
      upsert: false
    });

    if (uploadResult.error) {
      throw new Error(uploadResult.error.message);
    }
  }

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      slug: slugifyProjectName(name),
      color,
      logo_path: nextLogoPath
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  const staleLogoPaths = [existingProject.logo_path]
    .filter(Boolean)
    .filter((path) => path !== nextLogoPath) as string[];

  if (staleLogoPaths.length > 0) {
    await supabase.storage.from(env.bucket).remove(staleLogoPaths);
  }

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath("/posts/new");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectAction(projectId: string) {
  const supabase = getSupabaseAdmin();
  const env = getAppEnv();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: existingProject, error: fetchError } = await supabase
    .from("projects")
    .select("id, logo_path")
    .eq("id", projectId)
    .single();

  if (fetchError || !existingProject) {
    throw new Error("Project not found.");
  }

  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  if (existingProject.logo_path) {
    await supabase.storage.from(env.bucket).remove([existingProject.logo_path]).catch(() => undefined);
  }

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath("/posts/new");
  revalidatePath("/projects");
  redirect("/projects");
}
