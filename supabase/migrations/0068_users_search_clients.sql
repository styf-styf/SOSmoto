-- Allow any authenticated user to find client profiles by name
-- Needed for service report creation: linking walk-in clients to their app account
create policy users_search_clients on users
  for select
  using (auth.uid() is not null and role = 'client');
