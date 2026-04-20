import { getSupabaseClient } from '../src/services/supabaseClient';

const deleteAllCourses = async () => {
  const supabase = getSupabaseClient();

  // First, get all courses to show what will be deleted
  const { data: courses, error: fetchError } = await supabase
    .from('course')
    .select('*');

  if (fetchError) {
    console.error('Error fetching courses:', fetchError);
    return;
  }

  console.log('Found courses to delete:', courses?.length || 0);
  
  if (courses && courses.length > 0) {
    courses.forEach(c => {
      console.log(`- Course ID ${c.id}: ${c.course_code} (Semester ${c.semester}, Year ${c.year})`);
    });

    // Delete all courses
    const { error: deleteError } = await supabase
      .from('course')
      .delete()
      .neq('id', 0); // This will delete all rows (where id is not 0, which means all)

    if (deleteError) {
      console.error('Error deleting courses:', deleteError);
      return;
    }

    console.log('\n✅ Successfully deleted all', courses.length, 'courses permanently');
  } else {
    console.log('No courses found to delete');
  }

  process.exit(0);
};

deleteAllCourses();
