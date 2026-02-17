import {
  Live,
  User,
  Login,
  Video,
  Comment,
  Dynamic,
  Message,
  BiliCredential,
} from "bilicaptain";

// 检查是否符合律诗格式的函数
function isRegulatedVerse(text) {
  if (!text || typeof text !== "string") {
    return false;
  }

  // 移除空白字符并按行分割
  const lines = text
    .trim()
    .split(/[\n\r]+/)
    .filter((line) => line.trim().length > 0);

  // 律诗必须是8行
  if (lines.length !== 8) {
    return false;
  }

  // 检查每行字数，应该是5字或7字（五言律诗或七言律诗）
  const lineLengths = lines.map(
    (line) => line.trim().replace(/[^\u4e00-\u9fff]/g, "").length
  );

  // 所有行的字数应该相同
  const firstLineLength = lineLengths[0];
  if (firstLineLength !== 5 && firstLineLength !== 7) {
    return false;
  }

  // 检查所有行是否都有相同的字数
  const allSameLength = lineLengths.every(
    (length) => length === firstLineLength
  );

  return allSameLength;
}

const fetchAV = async () => {
  const SESSDATA =
    "52da2b97%2C1783952036%2C3649b%2A12CjD8J-VqA2p069J5cGqbdWF0DIdmSP57CnREIhFM78m0yBgq91gnLNEYZe60rkEa2McSVkVtNE5MemFlWEE3RW41bWRxOUtKWVBEdjZmcnRFS01FM3pxS3NwYW1mRm9QWVA2NjdCTVVYVllZSVFFRWRjZ28wNUVmU2dwN25saTVNSVc1UWZlbE93IIEC";
  const bili_jct = "09ca606db9d4a103b12d560b21155d84";

  try {
    const video = new Video(
      new BiliCredential(SESSDATA, bili_jct),
      "BV1b4iSByELC"
    );
    const detail = await video.detail();
    // console.log(detail);

    const oid = detail.aid;
    const replies = detail.stat.reply;
    // console.log(video);

    const list = await video.comment.list(2, 0, oid);
    // console.log(list);

    list.forEach((item) => {
      const username = item.member.uname;
      const message = item.content.message;

      // 检查message是否符合律诗格式
      const isPoetry = isRegulatedVerse(message);

      console.log(username, "------", message);
      if (isPoetry) {
        console.log("✓ 这是一首律诗格式的诗歌");
      } else {
        console.log("✗ 不符合律诗格式");
      }
      console.log("---");
    });
  } catch (error) {
    console.log(error);
  }

  //   try {
  //     const oid = 115857632004035;
  //     const type = 1;
  //     const cmt = new Comment(new BiliCredential(SESSDATA, bili_jct), oid, type);
  //     //   console.log(cmt);
  //     const res = await cmt.list(1);
  //     console.log(res);
  //   } catch (error) {
  //     console.log(error);
  //   }
};

fetchAV();
