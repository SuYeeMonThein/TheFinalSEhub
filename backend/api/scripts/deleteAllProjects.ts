import { getSupabaseAdminClient } from "../src/services/supabaseClient";

const deleteAllProjects = async () => {
  const supabase = getSupabaseAdminClient();

  const { data: projects, error: fetchError } = await supabase
    .from("project")
    .select("id, name, status, project_type");

  if (fetchError) {
    console.error("Error fetching projects:", fetchError);
    process.exit(1);
  }

  const total = projects?.length ?? 0;
  console.log("Found projects to delete:", total);

  if (total === 0) {
    console.log("No projects found to delete");
    process.exit(0);
  }

  projects?.forEach((project) => {
    console.log(
      `- ID ${project.id}: ${project.name} [${project.project_type}] (${project.status})`,
    );
  });

  const projectIds = (projects ?? []).map((project) => project.id);

  if (projectIds.length > 0) {
    const { error: teamMemberError } = await supabase
      .from("team_member")
      .delete()
      .in("project_id", projectIds);

    if (teamMemberError) {
      console.error("Error deleting team members:", teamMemberError);
      process.exit(1);
    }
  }

  const { error: deleteError } = await supabase
    .from("project")
    .delete()
    .neq("id", 0);

  if (deleteError) {
    console.error("Error deleting projects:", deleteError);
    console.error(
      "Note: this deletes only from project; foreign key constraints may require deleting related rows first.",
    );
    process.exit(1);
  }

  console.log("\n✅ Successfully deleted all", total, "projects");
  process.exit(0);
};

deleteAllProjects();
