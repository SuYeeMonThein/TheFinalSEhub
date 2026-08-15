import { getSupabaseClient } from '../src/services/supabaseClient';
import { getProjectById } from '../src/services/projectService';

const checkProject = async () => {
  const result = await getProjectById(10);
  
  if (result.error) {
    console.error('Error:', result.error);
    return;
  }
  
  console.log('=== PROJECT 10 FULL DATA ===');
  console.log(JSON.stringify(result.data, null, 2));
  
  process.exit(0);
};

checkProject();
