import { getSupabaseClient } from '../src/services/supabaseClient';
import { findUserByEmail } from '../src/services/userService';

/**
 * Script to fix advisor_id for projects that have advisor in team members metadata
 * but missing advisor_id in the project table
 */
async function fixAdvisorIds() {
  const supabase = getSupabaseClient();
  
  console.log('Fetching all projects...');
  const { data: projects, error: fetchError } = await supabase
    .from('project')
    .select('*');
  
  if (fetchError) {
    console.error('Error fetching projects:', fetchError);
    return;
  }
  
  if (!projects || projects.length === 0) {
    console.log('No projects found.');
    return;
  }
  
  console.log(`Found ${projects.length} projects. Checking for missing advisor_id...`);
  
  let fixedCount = 0;
  
  for (const project of projects) {
    // Skip if advisor_id is already set
    if (project.advisor_id) {
      continue;
    }
    
    // Check if metadata has team members
    const metadata = project.metadata;
    if (!metadata || typeof metadata !== 'object') {
      continue;
    }
    
    const teamMembers = (metadata as any).teamMembers;
    if (!Array.isArray(teamMembers)) {
      continue;
    }
    
    // Find lecturer in team members
    const advisor = teamMembers.find((member: any) => member.role === 'lecturer');
    if (!advisor || !advisor.email) {
      continue;
    }
    
    console.log(`\nProject "${project.name}" (ID: ${project.id}) has advisor ${advisor.email} but no advisor_id`);
    
    // Find user by email
    const advisorResult = await findUserByEmail(advisor.email);
    if (advisorResult.error || !advisorResult.data) {
      console.log(`  ⚠️  Could not find user with email ${advisor.email}`);
      continue;
    }
    
    const advisorUser = advisorResult.data;
    console.log(`  ✓ Found advisor: ${advisorUser.name} (ID: ${advisorUser.id})`);
    
    // Update project with advisor_id
    const { error: updateError } = await supabase
      .from('project')
      .update({ advisor_id: advisorUser.id })
      .eq('id', project.id);
    
    if (updateError) {
      console.log(`  ✗ Error updating project: ${updateError.message}`);
    } else {
      console.log(`  ✓ Updated advisor_id to ${advisorUser.id}`);
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} project(s)`);
}

// Run the script
fixAdvisorIds()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script error:', error);
    process.exit(1);
  });
