import { getSupabaseClient } from '../src/services/supabaseClient';

const revertTesting = async () => {
  const supabase = getSupabaseClient();

  // Revert the "testing" project back to under review
  const { data: updated, error } = await supabase
    .from('project')
    .update({ status: 'underreview' })
    .eq('name', 'testing')
    .select();

  if (error) {
    console.error('Error updating project:', error);
    return;
  }

  console.log('✅ Successfully reverted "testing" project to under review');
  if (updated && updated.length > 0) {
    console.log(`   Project ID ${updated[0].id}: ${updated[0].name} is now ${updated[0].status}`);
  }

  process.exit(0);
};

revertTesting();
