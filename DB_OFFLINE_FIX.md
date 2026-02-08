# Why "Test Connection ✓" but "Database Offline" can happen

Test Connection validates URL/key and performs a simple query.
Review & Export uses the live sync hook, which previously could read a *frozen* Supabase client created at module import time.

This build fixes it by:
- removing exported `supabase` singleton (which could be null forever if config saved after load)
- always creating the client dynamically from the latest saved runtime config
- improving the offline state logic so RLS/network errors don't masquerade as "missing table"
