-- Add organization_id column to activity_events for RLS-based org filtering
ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Backfill organization_id from organization_members
UPDATE activity_events ae
SET organization_id = om.organization_id
FROM organization_members om
WHERE om.user_id = ae.user_id
AND ae.organization_id IS NULL;

-- Create index for org-scoped queries
CREATE INDEX IF NOT EXISTS idx_activity_org ON activity_events (organization_id, created_at DESC);

-- Enable RLS (already enabled, but ensure it)
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- Policy 1: Platform admins see all activity
CREATE POLICY IF NOT EXISTS platform_admin_all ON activity_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy 2: Org admins see their org's activity
CREATE POLICY IF NOT EXISTS org_admin_org ON activity_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid()
      AND om1.org_role = 'admin'
      AND om2.user_id = activity_events.user_id
    )
  );

-- Policy 3: Users see own activity
CREATE POLICY IF NOT EXISTS user_own ON activity_events
  FOR SELECT USING (user_id = auth.uid());
