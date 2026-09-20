# User Manual

## 1. Overview

SE Project Hub is a web platform for managing student capstone and project submissions, advisor reviews, rubric-based grading, and course administration. It supports three major user roles:

- Student
- Advisor
- Coordinator

Each role has a different dashboard and set of permissions.

---

## 2. Getting Started

### 2.1 Access the application

Open the frontend application in your browser using the local development URL or the deployed production URL provided by your administrator.

Typical local setup:

- Frontend: http://localhost:8080
- Backend API: http://localhost:5001

### 2.2 Sign in

Use the university or project-provided authentication method. The app uses Firebase Authentication and supports login flows such as email/password and Google sign-in.

Once signed in, the platform reads your account role and shows the appropriate dashboard.

---

## 3. User Roles and Responsibilities

### 3.1 Student

Students can:

- View their own projects
- Submit or update project details
- Add team members and supporting links/files
- Track project status
- View comments and feedback from advisors
- Review rubric information
- Update account details

Typical student workflow:

1. Log in.
2. Open the project dashboard.
3. Create a new project submission.
4. Fill in project information, team members, files, and references.
5. Submit the project for review.
6. Monitor approval or revision feedback.

### 3.2 Advisor

Advisors can:

- Review student projects assigned to them
- View course-related project activity
- Leave feedback comments
- Assess submissions using rubrics
- Manage rubric criteria if authorized
- View account details

Typical advisor workflow:

1. Log in.
2. Open the advisee or course project list.
3. Review a project.
4. Leave remarks and evaluate rubric criteria.
5. Approve, reject, or request revisions.

### 3.3 Coordinator

Coordinators can:

- Manage users and roles
- Add and edit courses
- Manage student rosters
- Review all projects across the platform
- Configure rubrics
- View reports and analytics
- Maintain platform administration

Typical coordinator workflow:

1. Log in as coordinator.
2. Manage user onboarding and assignments.
3. Create or update courses and rosters.
4. Monitor project progress and reviews.
5. Generate reports and ensure the platform is up to date.

---

## 4. Managing Projects

### 4.1 Creating a project

From the dashboard:

1. Select the option to create a new project.
2. Enter the required project title and details.
3. Add team members if applicable.
4. Upload files or add links.
5. Save as draft or submit for review.

### 4.2 Editing a project

To revise a project:

1. Open the project from your project list.
2. Update fields as needed.
3. Save changes or resubmit for review after updates.

### 4.3 Submitting for review

When the project is ready:

1. Review all required fields.
2. Confirm file uploads and links are correct.
3. Click Submit or Send for Review.

The project status may change to a review state such as Under Review, Approved, or Rejected depending on the workflow.

### 4.4 Project status

Common project states include:

- Draft
- Under Review
- Approved
- Rejected

If your submission is rejected or returned for revisions, update the requested areas and resubmit.

---

## 5. Comments and Feedback

Reviewers may leave project comments to explain:

- strengths of the project
- missing requirements
- revision requests
- rubric concerns
- approval decisions

Students should check project comments regularly and respond by updating their submission if needed.

---

## 6. Rubrics and Grading

Rubrics are used to assess project quality consistently.

- Rubrics are defined by the coordinator or advisor team.
- Criteria may include technical quality, documentation, presentation, and project outcomes.
- Scores are assigned using rubric levels.

To use a rubric:

1. Open the project being reviewed.
2. Select the rubric or grading view.
3. Score each criterion.
4. Save the overall assessment.

---

## 7. Courses and Rosters

Coordinators can manage:

- course listings
- student enrollment
- roster updates
- course-specific project tracking

When a course is created or updated, the roster should reflect the correct student population for the active term.

---

## 8. User Management

Coordinator-level user administration may include:

- creating account records
- assigning roles
- managing advisor and student access
- verifying user details

Only authorized coordinators should perform these tasks.

---

## 9. Reports and Analytics

The platform includes reporting features for:

- project completion counts
- review summaries
- student outcomes
- course progress
- grading statistics

Use these features to monitor performance and ensure project milestones are being met.

---

## 10. Best Practices

- Check the dashboard regularly for updates.
- Submit clean, final project materials before review.
- Keep team member information accurate.
- Review comments carefully before revising a project.
- Do not submit incomplete project files unless the workflow explicitly allows it.
- Use the rubric as a guide to improve quality before final submission.

---

## 11. Troubleshooting

### 11.1 Unable to sign in

Try the following:

- Confirm the correct email and password
- Check whether Google sign-in is enabled for your account
- Refresh the page and retry
- Contact the system administrator if the account is missing or inactive

### 11.2 Project not saving

Possible causes:

- Missing required fields
- Unsupported file type
- Network interruption
- Session timeout

Refresh the page and try again. If the issue continues, contact support.

### 11.3 Missing project or incorrect data

Check:

- whether you are in the right account role
- whether the course or submission belongs to your assigned group
- whether permissions were recently updated

### 11.4 Review comments not visible

Ensure that:

- the correct project is selected
- the reviewer has submitted the feedback
- the page has been refreshed

---

## 12. Support and Contact

If you are having trouble accessing the platform, submitting a project, or viewing your review status, contact your course coordinator, advisor, or system administrator.

For technical issues, include:

- your role
- project or course name
- date and time of the issue
- browser and device details
- any error message shown

---

## 13. Quick Reference

### Student quick steps

1. Log in.
2. Open My Projects.
3. Create or edit a project.
4. Add files and team members.
5. Submit for review.
6. Check feedback and revise if needed.

### Advisor quick steps

1. Log in.
2. Open assigned projects.
3. Review submission details.
4. Add comments and score rubric criteria.
5. Approve, reject, or request revisions.

### Coordinator quick steps

1. Log in.
2. Manage users and courses.
3. Monitor all project submissions.
4. Review rubrics and analytics.
5. Support students and advisors.

---

## 14. Summary

SE Project Hub is designed to streamline project management, feedback, grading, and course administration. By understanding your role and following the steps above, you can efficiently submit projects, provide reviews, and manage academic workflows with confidence.
