import { getSupabaseClient } from '../src/services/supabaseClient';

const listProjects = async () => {
  const supabase = getSupabaseClient();

  const { data: projects, error } = await supabase
    .from('project')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching projects:', error);
    return;
  }

  console.log('Total projects in database:', projects?.length || 0);
  console.log('\nProject details:');
  
  if (projects && projects.length > 0) {
    projects.forEach(p => {
      console.log(`\nID: ${p.id}`);
      console.log(`  Name: ${p.name}`);
      console.log(`  Status: ${p.status}`);
      console.log(`  Type: ${p.project_type}`);
      console.log(`  Advisor ID: ${p.advisor_id}`);
    });
  } else {
    console.log('No projects found in database');
  }

  process.exit(0);
};

listProjects();
