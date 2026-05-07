-- Homepage featured services
ALTER TABLE "Service"
  ADD COLUMN "isFeaturedOnHomepage" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "homepageSortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Service_isFeaturedOnHomepage_homepageSortOrder_idx"
  ON "Service"("isFeaturedOnHomepage", "homepageSortOrder");
