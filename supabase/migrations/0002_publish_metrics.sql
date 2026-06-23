-- Tier 2: assisted publishing + manual analytics.
-- Track when a post was published and the metrics logged for the feedback loop.

alter table posts add column if not exists published_at timestamptz;
alter table posts add column if not exists metrics      jsonb;
