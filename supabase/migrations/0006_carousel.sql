-- Carousel: a post can hold up to 3 slide image URLs.
alter table posts add column if not exists images jsonb;
