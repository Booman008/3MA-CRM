const express = require('express');

const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [membersResult, leadsResult, recentContactsResult] = await Promise.all([
      db.query(
        `
          SELECT id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
                 "joinDate", "renewalDate", "duesAmount", "membershipTier", benefits, notes, "createdAt"
          FROM members
          ORDER BY "createdAt" DESC
        `
      ),
      db.query(
        `
          SELECT stage, COUNT(*)::int AS count
          FROM leads
          GROUP BY stage
          ORDER BY count DESC
        `
      ),
      db.query(
        `
          SELECT id, "entityId", "entityType", "entityName", "contactDate", "contactType",
                 summary, "nextAction", "nextActionDate", "createdAt"
          FROM contact_log
          ORDER BY "contactDate" DESC, "createdAt" DESC
          LIMIT 10
        `
      ),
    ]);

    const members = membersResult.rows.map((row) => ({
      ...row,
      duesAmount: row.duesAmount == null ? null : Number(row.duesAmount),
    }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysUntil = (value) => {
      if (!value) return null;
      const date = new Date(`${value}T00:00:00`);
      if (Number.isNaN(date.getTime())) return null;
      return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    };

    const totalLicenses = members.reduce((sum, member) => {
      if (!member.licenseNo) return sum;

      try {
        const parsed = JSON.parse(member.licenseNo);
        if (Array.isArray(parsed)) return sum + parsed.length;
      } catch {}

      return sum + member.licenseNo.split(',').map((value) => value.trim()).filter(Boolean).length;
    }, 0);

    const pastDueMembers = members
      .filter((member) => {
        const diff = daysUntil(member.renewalDate);
        return diff != null && diff < 0;
      })
      .sort((a, b) => (a.renewalDate || '').localeCompare(b.renewalDate || ''));

    const upcomingRenewals = members
      .filter((member) => {
        const diff = daysUntil(member.renewalDate);
        return diff != null && diff >= 0 && diff <= 60;
      })
      .sort((a, b) => (a.renewalDate || '').localeCompare(b.renewalDate || ''));

    const renewals30 = upcomingRenewals.filter((member) => {
      const diff = daysUntil(member.renewalDate);
      return diff != null && diff <= 30;
    }).length;

    const totalDues = members.reduce((sum, member) => sum + (member.duesAmount || 0), 0);

    res.json({
      totalMembers: members.length,
      totalLicenses,
      totalDues,
      renewals30,
      renewals60: upcomingRenewals.length,
      pastDueMembers,
      upcomingRenewals,
      leadsByStage: leadsResult.rows,
      recentContacts: recentContactsResult.rows,
    });
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
