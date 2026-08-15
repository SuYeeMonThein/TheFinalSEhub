import { getSupabaseClient } from '../src/services/supabaseClient';

const approveProjects = async () => {
  const supabase = getSupabaseClient();

  // Get all projects that are currently under review
  const { data: projects, error: fetchError } = await supabase
    .from('project')
    .select('*')
    .eq('status', 'underreview');

  if (fetchError) {
    console.error('Error fetching projects:', fetchError);
    return;
  }

  console.log('Found projects under review:', projects?.length);
  
  if (projects && projects.length > 0) {
    projects.forEach(p => {
      console.log(`- Project ID ${p.id}: ${p.name} (Status: ${p.status})`);
    });

    // Update all under review projects to approved
    const { data: updated, error: updateError } = await supabase
      .from('project')
      .update({ status: 'approved' })
      .eq('status', 'underreview')
      .select();

    if (updateError) {
      console.error('Error updating projects:', updateError);
      return;
    }

    console.log('\n✅ Successfully approved', updated?.length, 'projects');
    updated?.forEach(p => {
      console.log(`- ${p.name} is now ${p.status}`);
    });
  } else {
    console.log('No projects found under review');
  }

  process.exit(0);
};

approveProjects();
