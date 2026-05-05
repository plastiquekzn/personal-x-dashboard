import { PostsIndex } from "@/components/posts-index";
import { getProjects } from "@/lib/data/projects";
import { getPosts } from "@/lib/data/posts";

export default async function PostsPage() {
  const [posts, projects] = await Promise.all([getPosts(), getProjects()]);

  return (
    <main>
      <PostsIndex posts={posts} projects={projects} />
    </main>
  );
}
