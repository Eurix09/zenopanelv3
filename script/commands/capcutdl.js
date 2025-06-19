const fs = require("fs");
const path = require("path");
const axios = require("axios");

module.exports = {
  eurix: {
    name: "capcutdl",
    permission: "all",
    description: "CapCut Template Downloader",
    usage: "/capcutdl [url]",
    usages: "capcutdl [url]"
  },

  execute: async function(bot, msg, args) {
    try {
      const chatId = msg.chat.id;
      const url = args[0];

      if (!url) {
        return bot.sendMessage(chatId, "Please provide a CapCut template URL\nUsage: /capcutdl [url]");
      }

      const loadingMsg = await bot.sendMessage(chatId, "⏳ Downloading template...");

      // Make API request
      const response = await axios.get(`${global.config.api}/download/capcut?url=${url}&apikey=${global.config.key}`);

      if (!response.data.status) {
        return bot.sendMessage(chatId, "❌ Failed to download template. Please check the URL.");
      }

      const { title, coverUrl, authorName, videoUrl } = response.data;

      // Download and save video
      const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      const videoPath = path.join(__dirname, "cache", `capcut_${Date.now()}.mp4`);


      fs.writeFileSync(videoPath, Buffer.from(videoResponse.data));

      // Update status message
      await bot.editMessageText("✅ Template downloaded! Sending...", {
        chat_id: chatId,
        message_id: loadingMsg.message_id
      });

      // Send the video
      await bot.sendVideo(chatId, videoPath, {
        caption: `Downloaded Successfully\n\n*Title:* *${title}* Creator: ${authorName}`,
        parse_mode: "Markdown"
      });

    } catch (error) {
      console.error("CapCut Download Error:", error.message);
      bot.sendMessage(msg.chat.id, "❌ An error occurred while downloading the template.");
    }
  }
};