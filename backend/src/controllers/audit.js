import AuditLog from '../models/auditLog.js';
import User from '../models/user.js';

// Fetch audit logs (scoped to admin role)
export const getAuditLogs = async (req, res) => {
  try {
    const { roleName, verticalAccess, userId } = req.user;

    // Reject non-admins (agents)
    if (roleName !== 'super_admin' && roleName !== 'vertical_admin') {
      return res.status(403).json({ message: 'Access forbidden: only administrators can view audit logs' });
    }

    let query = {};

    if (roleName === 'vertical_admin') {
      // Find all users who share access to the admin's verticals
      const usersInVerticals = await User.find({ verticalAccess: { $in: verticalAccess } }).select('_id');
      const userIds = usersInVerticals.map(u => u._id);

      query = {
        $or: [
          { actorId: userId },
          { actorId: { $in: userIds } }
        ]
      };
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actorId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(query)
    ]);

    res.status(200).json({
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
