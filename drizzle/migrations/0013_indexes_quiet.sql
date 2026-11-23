CREATE INDEX "audit_log_tenant_created_idx" ON "audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "errors_display_created_idx" ON "errors" USING btree ("display_id","created_at");--> statement-breakpoint
CREATE INDEX "errors_created_idx" ON "errors" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "slides_tenant_active_idx" ON "slides" USING btree ("tenant_id","active");