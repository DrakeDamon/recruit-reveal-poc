/*
  Warnings:

  - The `user_id` column on the `Eval` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "Eval" DROP CONSTRAINT "Eval_user_id_fkey";

-- AlterTable
ALTER TABLE "Eval" DROP COLUMN "user_id",
ADD COLUMN     "user_id" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "graduation_year" INTEGER,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "privacy_setting" TEXT NOT NULL DEFAULT 'public',
ADD COLUMN     "profile_complete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profile_photo_url" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "video_links" TEXT[],
ADD COLUMN     "weight" INTEGER;

-- AddForeignKey
ALTER TABLE "Eval" ADD CONSTRAINT "Eval_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
