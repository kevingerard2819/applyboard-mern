import { randomUUID } from 'node:crypto';

export function sampleApplications(userId, now = new Date(), expiresAt) {
  const date = (days) => new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
  const interview = (days, label, notes) => ({
    id: randomUUID(),
    label,
    at: new Date(now.getTime() + days * 86400000).toISOString(),
    status: 'Scheduled',
    notes,
  });
  return [
    {
      company: 'Northstar',
      role: 'Frontend Engineer',
      location: 'Remote',
      status: 'Interview',
      appliedDate: date(-12),
      notes: 'Fictional example. Prepare a React project walkthrough.',
      interviewRounds: [
        interview(2, 'Technical interview', 'Discuss component design and API integration.'),
      ],
      followUpDate: date(0),
      nextStep: 'Confirm the interview agenda.',
    },
    {
      company: 'Studio Eleven',
      role: 'Full Stack Developer',
      location: 'London · Hybrid',
      status: 'Applied',
      appliedDate: date(-3),
      followUpDate: date(-1),
      nextStep: 'Ask the recruiter about the next round.',
    },
    {
      company: 'Bloom',
      role: 'Software Engineer',
      location: 'Remote',
      status: 'Wishlist',
      notes: 'Read about the product and engineering team before applying.',
    },
    {
      company: 'Orbit Labs',
      role: 'Product Engineer',
      location: 'Berlin',
      status: 'Offer',
      appliedDate: date(-36),
      notes: 'Compare the role responsibilities and team before responding.',
    },
    {
      company: 'Harbor',
      role: 'Backend Developer',
      location: 'Remote',
      status: 'Rejected',
      appliedDate: date(-45),
      notes: 'Keep the feedback for the next application.',
    },
    {
      company: 'Metric',
      role: 'Node.js Developer',
      location: 'Amsterdam · Hybrid',
      status: 'Applied',
      appliedDate: date(-18),
      followUpDate: date(3),
      nextStep: 'Check the application status.',
    },
    {
      company: 'Fieldwork',
      role: 'React Developer',
      location: 'Remote',
      status: 'Interview',
      appliedDate: date(-24),
      interviewRounds: [
        interview(4, 'Team interview', 'Prepare questions about code reviews and deployment.'),
      ],
      notes: 'Discuss collaboration across design and engineering.',
    },
    {
      company: 'Common Ground',
      role: 'Full Stack Engineer',
      location: 'Remote',
      status: 'Applied',
      appliedDate: date(-7),
      notes: 'Tailor the project examples to their stack.',
    },
  ].map((application) => ({
    ...application,
    userId,
    ...(expiresAt ? { expiresAt } : {}),
    activity: [{ message: 'Fictional sample application added', at: now }],
  }));
}
