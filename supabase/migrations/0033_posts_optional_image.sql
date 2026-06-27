alter table posts alter column image_url drop not null;

alter table posts add constraint posts_content_check check (
  image_url is not null or caption is not null
);
