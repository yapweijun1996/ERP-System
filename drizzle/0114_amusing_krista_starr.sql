DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_agent_workflow_run_tenant_id'
      AND conrelid = 'agent_workflow_run'::regclass
  ) THEN
    ALTER TABLE "agent_workflow_run"
      ADD CONSTRAINT "uq_agent_workflow_run_tenant_id" UNIQUE("id","master_fn","company_fn");
  END IF;
END $$;