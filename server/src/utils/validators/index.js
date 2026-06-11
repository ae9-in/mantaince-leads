import { z } from 'zod';

export const LoginBody = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required')
});

export const InviteUserBody = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Invalid email address format').toLowerCase().trim(),
  role: z.enum(['super_admin', 'vertical_admin', 'agent'], {
    errorMap: () => ({ message: 'Invalid role selection' })
  }),
  password: z.string().min(6, 'Initial password must be at least 6 characters'),
  verticalAccess: z.array(z.string()).default([])
});

export const UpdateUserBody = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  role: z.enum(['super_admin', 'vertical_admin', 'agent']).optional(),
  verticalAccess: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

export const CreateVerticalBody = z.object({
  name: z.string().min(1, 'Vertical name is required').trim(),
  description: z.string().optional().default(''),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code').default('#185FA5'),
  icon: z.string().default('Layers')
});

export const CreateSubVerticalBody = z.object({
  name: z.string().min(1, 'Sub-vertical name is required').trim()
});

export const CreateFieldConfigBody = z.object({
  fieldKey: z.string().regex(/^[a-z0-9_]+$/, 'Field key must be lowercase letters, numbers, or underscores only'),
  label: z.string().min(1, 'Field label is required').trim(),
  fieldType: z.enum(['text', 'number', 'phone', 'email', 'url', 'boolean', 'select', 'multiselect', 'date', 'textarea']),
  options: z.array(z.string()).default([]),
  placeholder: z.string().optional().default(''),
  defaultValue: z.any().optional().default(null),
  isRequired: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  isTableColumn: z.boolean().default(true),
  isCsvMapped: z.boolean().default(true),
  csvHeader: z.string().optional().default(''),
  validationRegex: z.string().optional().default(''),
  validationMessage: z.string().optional().default(''),
  displayOrder: z.number().default(0)
});

export const UpdateLeadStatusBody = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'lost', 'invalid'])
});

export const ReorderBody = z.array(z.object({
  id: z.string().min(1, 'ID is required'),
  displayOrder: z.number()
}));

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUUID = (val) => typeof val === 'string' && UUID_REGEX.test(val);

