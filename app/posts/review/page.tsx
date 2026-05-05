import { ReviewPostWorkspace } from "@/components/review-post-workspace";
import { getProjects } from "@/lib/data/projects";

export default async function ReviewPostPage() {
  const projects = await getProjects();

  return (
    <main>
      <ReviewPostWorkspace projects={projects} />
    </main>
  );
}
