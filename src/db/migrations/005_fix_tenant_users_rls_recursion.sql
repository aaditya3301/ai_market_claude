BEGIN;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(target_tenant UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tenant_users tu
    WHERE tu.tenant_id = target_tenant
      AND tu.auth_user_id = auth.uid()
      AND tu.role IN ('owner', 'admin')
  );
$$;

DROP POLICY IF EXISTS tenant_users_admin_manage ON tenant_users;

CREATE POLICY tenant_users_admin_manage ON tenant_users
  FOR ALL
  USING (
    auth_user_id = auth.uid() OR public.is_tenant_admin(tenant_id)
  )
  WITH CHECK (
    auth_user_id = auth.uid() OR public.is_tenant_admin(tenant_id)
  );

COMMIT;
