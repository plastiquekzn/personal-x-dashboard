import { NewPostWorkspace } from "@/components/new-post-workspace";
import { getProjects } from "@/lib/data/projects";

export default async function NewPostPage() {
  const projects = await getProjects();

  return (
    <main>
      <NewPostWorkspace projects={projects} />
    </main>
  );
}
