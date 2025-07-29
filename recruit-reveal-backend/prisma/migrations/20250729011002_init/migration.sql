/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "Eval" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "player_name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "division" TEXT NOT NULL,
    "notes" TEXT,
    "eval_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "probability" DOUBLE PRECISION,
    "performance_score" DOUBLE PRECISION,
    "combine_score" DOUBLE PRECISION,
    "upside_score" DOUBLE PRECISION,
    "underdog_bonus" DOUBLE PRECISION,
    "goals" TEXT[],
    "switches" TEXT,
    "calendar_advice" TEXT,

    CONSTRAINT "Eval_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Eval" ADD CONSTRAINT "Eval_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
