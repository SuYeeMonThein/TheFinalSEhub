import { getSupabaseClient } from '../src/services/supabaseClient';

const updateProjectAdvisor = async () => {
  const supabase = getSupabaseClient();
  
  // Get the advisor for course 1
  const { data: course } = await supabase
    .from('course')
    .select('advisor_id')
    .eq('id', 1)
    .single();
  
  if (course) {
    console.log(`Course 1 advisor ID: ${course.advisor_id}`);
    
    // Update project 10 to have this advisor
    const { error } = await supabase
      .from('project')
      .update({ advisor_id: course.advisor_id })
      .eq('id', 10);
    
    if (error) {
      console.error('Error updating project:', error);
    } else {
      console.log('✅ Updated project 10 with advisor ID:', course.advisor_id);
    }
  }
  
  // Verify the update
  const { data: project } = await supabase
    .from('project')
    .select('*')
    .eq('id', 10)
    .single();
  
  console.log('\n=== PROJECT 10 UPDATED ===');
  console.log(`Name: ${project.name}`);
  console.log(`Advisor ID: ${project.advisor_id}`);
  console.log(`Course ID: ${project.course_id}`);
  console.log(`Status: ${project.status}`);
  
  process.exit(0);
};

updateProjectAdvisor();
