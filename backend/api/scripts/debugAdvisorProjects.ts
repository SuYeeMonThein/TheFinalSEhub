import { getSupabaseClient } from '../src/services/supabaseClient';

/**
 * Debug script to check advisor assignments
 */
async function debugAdvisorProjects() {
  const supabase = getSupabaseClient();
  
  // Get the advisor's user record
  const advisorEmail = '6631503082@lamduan.mfu.ac.th';
  console.log(`Looking for advisor: ${advisorEmail}\n`);
  
  const { data: advisor, error: advisorError } = await supabase
    .from('user')
    .select('*')
    .eq('email', advisorEmail)
    .single();
  
  if (advisorError || !advisor) {
    console.log('❌ Advisor not found in database');
    return;
  }
  
  console.log(`✓ Found advisor: ${advisor.name} (ID: ${advisor.id}, Role: ${advisor.role})\n`);
  
  // Get all projects
  const { data: allProjects, error: allError } = await supabase
    .from('project')
    .select('*')
    .order('id', { ascending: false });
  
  if (allError) {
    console.error('Error fetching projects:', allError);
    return;
  }
  
  console.log(`Total projects in database: ${allProjects?.length || 0}\n`);
  
  // Check projects with advisor_id set
  const projectsWithAdvisorId = allProjects?.filter(p => p.advisor_id === advisor.id) || [];
  console.log(`Projects with advisor_id = ${advisor.id}: ${projectsWithAdvisorId.length}`);
  projectsWithAdvisorId.forEach(p => {
    console.log(`  - ${p.name} (ID: ${p.id}, Status: ${p.status})`);
  });
  
  console.log('\n---\n');
  
  // Check all projects for advisor in metadata
  console.log('Projects with advisor in team members metadata:');
  let count = 0;
  for (const project of allProjects || []) {
    const metadata = project.metadata as any;
    if (metadata?.teamMembers) {
      const hasAdvisor = metadata.teamMembers.some((m: any) => 
        m.email?.toLowerCase() === advisorEmail.toLowerCase() && m.role === 'lecturer'
      );
      if (hasAdvisor) {
        count++;
        console.log(`  - ${project.name} (ID: ${project.id}, advisor_id: ${project.advisor_id || 'NULL'}, Status: ${project.status})`);
      }
    }
  }
  console.log(`Total: ${count}\n`);
}

debugAdvisorProjects()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
