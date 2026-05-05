import { PostsIndex } from "@/components/posts-index";
import { getProjects } from "@/lib/data/projects";
import { getPosts } from "@/lib/data/posts";
import { isGeminiConfigured, isSupabaseConfigured } from "@/lib/env";
import { formatDateOnly } from "@/lib/format";
import type { PostRecord, ProjectRecord } from "@/lib/types";

function getPostReferenceDate(post: PostRecord) {
  return new Date(post.posted_at ?? post.created_at);
}

function isSameMonth(date: Date, monthStart: Date) {
  return date.getUTCFullYear() === monthStart.getUTCFullYear() && date.getUTCMonth() === monthStart.getUTCMonth();
}

function buildProjectOverview(projects: ProjectRecord[], posts: PostRecord[]) {
  const monthStart = new Date();

  return projects.map((project) => {
    const projectPosts = posts.filter((post) => post.project_id === project.id);
    const projectPostsWithDates = projectPosts
      .map((post) => ({
        ...post,
        referenceDate: getPostReferenceDate(post)
      }))
      .filter((post) => !Number.isNaN(post.referenceDate.getTime()));

    const postsThisMonth = projectPostsWithDates.filter((post) => isSameMonth(post.referenceDate, monthStart)).length;
    const latestPost = [...projectPostsWithDates].sort(
      (left, right) => right.referenceDate.getTime() - left.referenceDate.getTime()
    )[0];

    return {
      projectId: project.id,
      projectName: project.name,
      totalPosts: projectPosts.length,
      postsThisMonth,
      latestPostedAt: latestPost?.posted_at ?? latestPost?.created_at ?? null
    };
  });
}

export default async function HomePage() {
  const [posts, projects] = await Promise.all([getPosts(), getProjects()]);
  const supabaseConfigured = isSupabaseConfigured();
  const geminiConfigured = isGeminiConfigured();
  const projectOverview = buildProjectOverview(projects, posts);

  return (
    <main className="page">
      {!supabaseConfigured ? (
        <section className="empty-state">
          <h2>Supabase setup is still pending</h2>
          <p>
            Create your Supabase project, run the SQL schema, and fill in `.env.local` so the pages can start reading
            and writing real data.
          </p>
        </section>
      ) : null}

      {supabaseConfigured && !geminiConfigured ? (
        <section className="empty-state">
          <h2>Gemini key is still missing</h2>
          <p>Add `GEMINI_API_KEY` to `.env.local` so screenshot extraction can start working.</p>
        </section>
      ) : null}

      {projectOverview.length > 0 ? (
        <section className="project-overview-grid">
          <article className="project-overview-card">
            <h3>Projects</h3>
            <div className="project-overview-list">
              {projectOverview.map((entry) => (
                <div key={entry.projectId} className="project-overview-item">
                  <span className="project-overview-name">{entry.projectName}</span>
                  <span className="project-overview-value">{entry.totalPosts} posts</span>
                </div>
              ))}
            </div>
          </article>

          <article className="project-overview-card">
            <h3>Posts This Month</h3>
            <div className="project-overview-list">
              {projectOverview.map((entry) => (
                <div key={entry.projectId} className="project-overview-item">
                  <span className="project-overview-name">{entry.projectName}</span>
                  <span className="project-overview-value">{entry.postsThisMonth} posts</span>
                </div>
              ))}
            </div>
          </article>

          <article className="project-overview-card">
            <h3>Latest Project Post</h3>
            <div className="project-overview-list">
              {projectOverview.map((entry) => (
                <div key={entry.projectId} className="project-overview-item">
                  <span className="project-overview-name">{entry.projectName}</span>
                  <span className="project-overview-value">{formatDateOnly(entry.latestPostedAt)}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      <PostsIndex posts={posts} projects={projects} />
    </main>
  );
}
