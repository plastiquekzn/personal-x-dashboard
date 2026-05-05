import { notFound } from "next/navigation";

import { PostDetailEditor } from "@/components/post-detail-editor";
import { getProjects } from "@/lib/data/projects";
import { getPostById, getSignedScreenshotUrl } from "@/lib/data/posts";

type PostDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { id } = await params;
  const [post, projects] = await Promise.all([getPostById(id), getProjects()]);

  if (!post) {
    notFound();
  }

  const screenshotUrl = await getSignedScreenshotUrl(post.screenshot_path);

  return <PostDetailEditor post={post} projects={projects} screenshotUrl={screenshotUrl} />;
}
