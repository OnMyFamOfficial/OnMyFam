-- Make posts bucket public so image URLs work
update storage.buckets set public = true where id = 'posts';
