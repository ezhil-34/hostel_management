/**
 * Who may change what, on their own profile.
 *
 * This is the single source of truth for field permissions. The API enforces
 * it and also ships it to the browser via `GET /api/profile`, so the UI never
 * has to hard-code its own copy — an input is rendered editable, locked, or
 * hidden purely from what the server says.
 *
 * Three levels:
 *   SELF      — edit it directly with PATCH /api/profile
 *   REQUEST   — locked; raise a change request for a warden/admin to approve
 *   READ_ONLY — never editable through the profile module at all
 */

export const ACCESS = {
  SELF: 'SELF',
  REQUEST: 'REQUEST',
  READ_ONLY: 'READ_ONLY',
};

/** Display metadata so the UI does not need a parallel list of labels. */
export const FIELD_META = {
  name: { label: 'Full Name', type: 'text', placeholder: 'John Doe' },
  email: { label: 'Email', type: 'email', placeholder: 'john@student.edu' },
  rollNumber: { label: 'Roll Number', type: 'text', placeholder: '21CS104' },
  phone: { label: 'Phone Number', type: 'tel', placeholder: '+91 98765 43210' },
  roomNo: { label: 'Room Number', type: 'text', placeholder: 'B-302' },
  hostelBlock: { label: 'Hostel Block', type: 'text', placeholder: 'B' },
  role: { label: 'Role', type: 'text' },
};

/** Order matters — the UI renders fields in this sequence. */
export const PROFILE_FIELDS = Object.keys(FIELD_META);

const { SELF, REQUEST, READ_ONLY } = ACCESS;

const POLICY = {
  STUDENT: {
    name: REQUEST,
    email: REQUEST,
    rollNumber: REQUEST,
    phone: SELF,
    roomNo: REQUEST,
    hostelBlock: REQUEST,
    role: READ_ONLY,
  },
  // Staff keep the same institutional locks as students; only admins are
  // trusted to change their own identifying details without review.
  STAFF: {
    name: REQUEST,
    email: REQUEST,
    rollNumber: REQUEST,
    phone: SELF,
    roomNo: REQUEST,
    hostelBlock: REQUEST,
    role: READ_ONLY,
  },
  WARDEN: {
    name: SELF,
    email: REQUEST,
    rollNumber: REQUEST,
    phone: SELF,
    roomNo: SELF,
    hostelBlock: SELF,
    role: READ_ONLY,
  },
  ADMIN: {
    name: SELF,
    email: SELF,
    rollNumber: REQUEST,
    phone: SELF,
    roomNo: SELF,
    hostelBlock: SELF,
    role: READ_ONLY,
  },
};

/** Roles allowed to approve or reject other people's change requests. */
export const REVIEWER_ROLES = ['WARDEN', 'ADMIN'];

export const isReviewer = (role) => REVIEWER_ROLES.includes(role);

export const policyForRole = (role) => POLICY[role] ?? POLICY.STUDENT;

export const accessFor = (role, field) => policyForRole(role)[field] ?? ACCESS.READ_ONLY;

export const selfEditableFields = (role) =>
  PROFILE_FIELDS.filter((f) => accessFor(role, f) === ACCESS.SELF);

export const requestableFields = (role) =>
  PROFILE_FIELDS.filter((f) => accessFor(role, f) === ACCESS.REQUEST);

/**
 * The shape sent to the browser. Each entry tells the UI exactly how to render
 * that input, so permission logic lives in one place.
 */
export const describePolicy = (role) =>
  PROFILE_FIELDS.map((field) => ({
    field,
    ...FIELD_META[field],
    access: accessFor(role, field),
    editable: accessFor(role, field) === ACCESS.SELF,
    requiresApproval: accessFor(role, field) === ACCESS.REQUEST,
  }));
