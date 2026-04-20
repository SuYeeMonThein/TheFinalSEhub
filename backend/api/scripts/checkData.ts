import { getSupabaseClient } from '../src/services/supabaseClient';

const checkData = async () => {
  const supabase = getSupabaseClient();
  
  console.log('=== COURSES ===');
  const { data: courses } = await supabase.from('course').select('*');
  courses?.forEach(c => console.log(`ID: ${c.id}, Code: ${c.course_code}, Advisor: ${c.advisor_id}`));
  
  console.log('\n=== PROJECTS ===');
  const { data: projects } = await supabase.from('project').select('*');
  projects?.forEach(p => console.log(`ID: ${p.id}, Name: ${p.name}, CourseID: ${p.course_id}, Status: ${p.status}`));
  
  process.exit(0);
};

checkData();
