-- Post images: store the public image URL and the prompt used to generate it.
alter table posts add column if not exists image_url    text;
alter table posts add column if not exists image_prompt text;
