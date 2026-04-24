-- Add dedicated portrait targets so homepage and /o-mne can use different images.
ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'PORTRAIT_HOME';
ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'PORTRAIT_ABOUT';
