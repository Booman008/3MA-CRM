const express = require('express');

const db = require('../database');
const r2 = require('../r2');

const router = express.Router();

function parseLicenseCount(licenseNo) {
  if (!licenseNo) return 0;
  try {
    const parsed = JSON.parse(licenseNo);
    if (Array.isArray(parsed)) return parsed.length;
  } catch {}
  return licenseNo.split(',').map((value) => value.trim()).filter(Boolean).length;
}

router.get('/', async (req, res) => {
  try {
    const [membersResult, leadsResult, recentContactsResult, todayTasksResult, overdueTasksResult, logoMembersResult, logoLeadsResult] = await Promise.all([
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
      db.query(
        `SELECT id, title, "dueDate", priority, "entityType", "entityId", "entityName"
         FROM tasks
         WHERE completed = FALSE AND "dueDate" = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
         ORDER BY CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END`
      ),
      db.query(
        `SELECT id, title, "dueDate", priority, "entityType", "entityId", "entityName"
         FROM tasks
         WHERE completed = FALSE AND "dueDate" IS NOT NULL AND "dueDate" < to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
         ORDER BY "dueDate" ASC LIMIT 20`
      ),
      db.query(
        `SELECT m.id AS "entityId", 'member' AS "entityType", m."businessName", m."ownerName", m."membershipTier",
                m."createdAt" AS "updatedAt", a."r2Key" AS "logoR2Key"
         FROM members m
         JOIN attachments a ON a.id = m."logoAttachmentId"
         ORDER BY m."createdAt" DESC
         LIMIT 8`
      ),
      db.query(
        `SELECT l.id AS "entityId", 'lead' AS "entityType", l."businessName", l."ownerName", l.stage,
                l."createdAt" AS "updatedAt", a."r2Key" AS "logoR2Key"
         FROM leads l
         JOIN attachments a ON a.id = l."logoAttachmentId"
         ORDER BY l."createdAt" DESC
         LIMIT 8`
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

    const totalLicenses = members.reduce((sum, member) => sum + parseLicenseCount(member.licenseNo), 0);

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

    const logoEntities = [...logoMembersResult.rows, ...logoLeadsResult.rows]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 8);

    const resolvedLogoEntities = await Promise.all(logoEntities.map(async (row) => {
      let logoUrl = null;
      if (row.logoR2Key && r2.isConfigured()) {
        try { logoUrl = await r2.getInlineUrl(row.logoR2Key); } catch {}
      }
      return {
        entityType: row.entityType,
        entityId: row.entityId,
        businessName: row.businessName,
        ownerName: row.ownerName,
        stage: row.stage || null,
        membershipTier: row.membershipTier || null,
        updatedAt: row.updatedAt,
        logoUrl,
      };
    }));

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
      todayTasks: todayTasksResult.rows,
      overdueTasks: overdueTasksResult.rows,
      logoEntities: resolvedLogoEntities,
    });
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
