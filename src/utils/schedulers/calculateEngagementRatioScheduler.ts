import cron from "node-cron";
import { PostModel } from "../../post/post.model";
import { PostViewModel } from "../../post/postView.model";

// calculate engagement ratio for all posts every hour
export const calculateEngagementRatioScheduler = cron.schedule(
  "0 * * * *",
  async () => {
    try {
      console.log("🔄 Calculating engagement ratio");

      // Step 1: Get impressions for all posts in bulk
      const impressions = await PostViewModel.aggregate([
        { $group: { _id: "$postId", count: { $sum: 1 } } },
      ]);

      // Convert to Map for fast lookup
      const impressionsMap = new Map(
        impressions.map((i) => [i._id.toString(), i.count])
      );

      // Step 2: Get posts
      const posts = await PostModel.find({ isDeleted: false })
        .select("likesCount commentsCount sharesCount savesCount")
        .lean();

      // Step 3: Prepare bulk updates
      const bulkOps = posts.map((post) => {
        const engagements =
          post.likesCount +
          post.commentsCount +
          post.sharesCount +
          post.savesCount;

        const postImpressions = impressionsMap.get(post._id.toString()) || 0;
        const engagementRatio =
          postImpressions > 0 ? engagements / postImpressions : 0;

        return {
          updateOne: {
            filter: { _id: post._id },
            update: { $set: { engagementRatio } },
          },
        };
      });

      if (bulkOps.length > 0) {
        await PostModel.bulkWrite(bulkOps);
      }

      console.log("✅ Engagement ratios updated for all posts");
    } catch (error) {
      console.error("❌ Error calculating engagement ratio", error);
    }
  },
  { timezone: "Asia/Kolkata" }
);
