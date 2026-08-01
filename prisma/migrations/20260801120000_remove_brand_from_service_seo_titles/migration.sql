UPDATE "Service"
SET "seoTitle" = regexp_replace("seoTitle", '\s*\|\s*PP Studio\s*$', '')
WHERE "seoTitle" ~ '\s*\|\s*PP Studio\s*$';
