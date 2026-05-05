import { createProjectAction } from "@/app/projects/actions";
import { getProjects } from "@/lib/data/projects";
import { isSupabaseConfigured } from "@/lib/env";

export default async function ProjectsPage() {
  const projects = await getProjects();
  const configured = isSupabaseConfigured();

  return (
    <main className="page">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Manual routing</p>
            <h2>Projects</h2>
            <p>Keep the list small in v1 so assigning screenshots stays fast and predictable.</p>
          </div>
        </div>

        <div className="grid-two">
          <form action={createProjectAction} className="panel">
            <div className="panel-header">
              <div>
                <h3>Create Project</h3>
                <p>Each saved post points to one project from this list.</p>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="name">Project Name</label>
                <input id="name" name="name" placeholder="Launch campaign" disabled={!configured} />
              </div>

              <div className="field">
                <label htmlFor="color">Color</label>
                <div className="color-input-row">
                  <input
                    id="color"
                    name="color"
                    type="color"
                    defaultValue="#0f766e"
                    className="color-picker-input"
                    disabled={!configured}
                  />
                  <span className="color-picker-note">Pick the project color for labels in the posts table.</span>
                </div>
              </div>

              <div className="field">
                <label htmlFor="logo">Logo</label>
                <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={!configured} />
              </div>

              <button type="submit" className="button" disabled={!configured}>
                Add Project
              </button>
            </div>
          </form>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Existing Projects</h3>
                <p>{projects.length} project(s) available for the dropdown.</p>
              </div>
            </div>

            {configured ? (
              projects.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Slug</th>
                        <th>Color</th>
                        <th>Logo</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((project) => (
                        <tr key={project.id}>
                          <td>
                            <div className="project-table-name">
                              {project.logo_url ? (
                                <img src={project.logo_url} alt={`${project.name} logo`} className="project-logo project-logo-sm" />
                              ) : (
                                <span className="project-logo-fallback project-logo-sm">
                                  {project.name.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <span style={project.color ? { color: project.color } : undefined}>{project.name}</span>
                            </div>
                          </td>
                          <td>{project.slug}</td>
                          <td>
                            {project.color ? (
                              <div className="project-color-cell">
                                <span className="project-color-swatch" style={{ backgroundColor: project.color }} />
                                <span>{project.color}</span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            {project.logo_url ? (
                              <img src={project.logo_url} alt={`${project.name} logo`} className="project-logo project-logo-sm" />
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <a href={`/projects/${project.id}`} className="table-link">
                              Manage
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <h3>No projects yet</h3>
                  <p>Create your first one here before trying the screenshot flow.</p>
                </div>
              )
            ) : (
              <div className="empty-state">
                <h3>Supabase is not configured yet</h3>
                <p>Fill in `.env.local`, run the SQL schema, and this page will become live.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
