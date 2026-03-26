/**
 * Formats posts strictly in 5-post rows:
 * - Uses [4img + 1tape] or [1tape + 4img] patterns first
 * - After tapes are exhausted, continues full rows of 5 images
 * - Ignores incomplete rows
 */
export const formatPostsInPattern = (
  posts: any[],
  limit: number = 20
): any[] => {
  const imagePosts = posts.filter((p) => p.mediaType === "image");
  const tapePosts = posts.filter((p) => p.mediaType === "video");

  const finalResult: any[] = [];
  let imageIndex = 0;
  let tapeIndex = 0;
  let blockPattern = 0; // 0: 4img+1tape, 1: 1tape+4img

  // 🔁 First: alternate tape+image pattern rows
  while (finalResult.length + 5 <= limit) {
    const block: any[] = [];

    if (blockPattern === 0) {
      if (imageIndex + 4 > imagePosts.length || tapeIndex >= tapePosts.length)
        break;
      for (let i = 0; i < 4; i++) block.push(imagePosts[imageIndex++]);
      block.push(tapePosts[tapeIndex++]);
    } else {
      if (tapeIndex >= tapePosts.length || imageIndex + 4 > imagePosts.length)
        break;
      block.push(tapePosts[tapeIndex++]);
      for (let i = 0; i < 4; i++) block.push(imagePosts[imageIndex++]);
    }

    finalResult.push(...block);
    blockPattern = 1 - blockPattern;
  }

  // ✅ After tapes used, fill remaining 5-image blocks
  while (
    finalResult.length + 5 <= limit &&
    imageIndex + 5 <= imagePosts.length
  ) {
    for (let i = 0; i < 5; i++) {
      finalResult.push(imagePosts[imageIndex++]);
    }
  }

  return finalResult;
};
