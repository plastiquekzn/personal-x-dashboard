import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteProjectAction, updateProjectAction } from "@/app/projects/actions";
import { getProjects } from "@/lib/data/projects";

type ProjectDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;
  const projects = await getProjects();
  const project = projects.find((entry) => entry.id === id);

  if (!project) {
    notFound();
  }

  const updateAction = updateProjectAction.bind(null, project.id);
  const removeAction = deleteProjectAction.bind(null, project.id);

  return (
    <main className="page">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Project settings</p>
            <h2>{project.name}</h2>
            <p>Update project name, color, logo, or remove the project entirely.</p>
          </div>
          <Link href="/projects" className="button-ghost">
            Back to Projects
          </Link>
        </div>

        <div className="grid-two">
          <form action={updateAction} className="panel">
            <div className="panel-header">
              <div>
                <h3>Edit Project</h3>
                <p>Changes here immediately affect the posts table and project dropdowns.</p>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="name">Project Name</label>
                <input id="name" name="name" defaultValue={project.name} />
              </div>

              <div className="field">
                <label htmlFor="color">Color</label>
                <div className="color-input-row">
                  <input
                    id="color"
                    name="color"
                    type="color"
                    defaultValue={project.color ?? "#0f766e"}
                    className="color-picker-input"
                  />
                  <span className="color-picker-note">{project.color ?? "#0f766e"}</span>
                </div>
              </div>

              <div className="field">
                <label htmlFor="logo">Replace Logo</label>
                <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
              </div>

              {project.logo_url ? (
                <div className="field">
                  <label>Current Logo</label>
                  <div className="subtle-box project-logo-panel">
                    <img src={project.logo_url} alt={`${project.name} logo`} className="project-logo project-logo-lg" />
                    <label className="checkbox-row">
                      <input type="checkbox" name="removeLogo" />
                      <span>Remove current logo</span>
                    </label>
                  </div>
                </div>
              ) : null}

              <button type="submit" className="button">
                Save Project
              </button>
            </div>
          </form>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Danger Zone</h3>
                <p>Deleting a project is blocked if posts still point to it.</p>
              </div>
            </div>

            <div className="subtle-box">
              <p>If the database says the project is still in use, move or delete those posts first.</p>
              <form action={removeAction}>
                <button type="submit" className="button-danger">
                  Delete Project
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
